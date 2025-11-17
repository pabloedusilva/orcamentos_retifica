const os = require('os');
const net = require('net');
const fs = require('fs');
const path = require('path');
const ipp = require('ipp');
const { prisma } = require('../db/prisma');

function getLocalSubnet() {
  const nics = os.networkInterfaces();
  for (const name of Object.keys(nics)) {
    for (const ni of nics[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        const ip = ni.address; // e.g., 192.168.1.50
        const parts = ip.split('.');
        if (parts.length === 4) {
          // Use /24 range by default for simplicity
          return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
      }
    }
  }
  // Fallback common LAN
  return '192.168.0.0/24';
}

function ipsFromCidr(cidr) {
  // Supports only /24 CIDR for simplicity
  const [base, mask] = cidr.split('/');
  const p = base.split('.').map(n => parseInt(n, 10));
  const prefix = parseInt(mask, 10);
  if (p.length !== 4 || prefix !== 24) {
    // degrade to /24 from provided base
    const pb = base.split('.');
    return Array.from({ length: 254 }, (_, i) => `${pb[0]}.${pb[1]}.${pb[2]}.${i + 1}`);
  }
  return Array.from({ length: 254 }, (_, i) => `${p[0]}.${p[1]}.${p[2]}.${i + 1}`);
}

function checkPort(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const cleanup = (result) => {
      if (done) return; done = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cleanup(true));
    socket.once('timeout', () => cleanup(false));
    socket.once('error', () => cleanup(false));
    socket.connect(port, host);
  });
}

async function isPrinter(host) {
  // Consider printer if either 9100 (raw) or 631 (IPP) is open
  const [p9100, p631] = await Promise.all([
    checkPort(host, 9100),
    checkPort(host, 631)
  ]);
  return p9100 || p631;
}

async function ensureSingleton() {
  let row = await prisma.printerSetting.findUnique({ where: { id: 'singleton' } });
  if (!row) {
    row = await prisma.printerSetting.create({ data: { id: 'singleton', ip: null, name: null } });
  }
  return row;
}

async function getCurrent(req, res) {
  const row = await ensureSingleton();
  let reachable = false;
  if (row.ip) {
    try { reachable = await isPrinter(row.ip); } catch {}
  }
  return res.json({ ip: row.ip, name: row.name, reachable });
}

async function connect(req, res) {
  const { ip, name } = req.body || {};
  if (!ip) return res.status(400).json({ error: 'IP é obrigatório' });
  // Salva mesmo que não responda agora; validamos no momento da impressão
  const row = await prisma.printerSetting.upsert({
    where: { id: 'singleton' },
    update: { ip, name: name || null },
    create: { id: 'singleton', ip, name: name || null }
  });
  // Teste de reachability não bloqueante
  let reachable = false;
  try { reachable = await isPrinter(ip); } catch(_) {}
  return res.json({ ok: true, ip: row.ip, name: row.name, reachable });
}

async function scan(req, res) {
  try {
    const primarySubnet = req.query.subnet || getLocalSubnet();
    const candidates = new Set(ipsFromCidr(primarySubnet));
    // Expand to common home subnets to improve hit rate
    try {
      const base = primarySubnet.split('/')[0];
      if (!base.startsWith('192.168.0.')) ipsFromCidr('192.168.0.0/24').forEach(ip => candidates.add(ip));
      if (!base.startsWith('192.168.1.')) ipsFromCidr('192.168.1.0/24').forEach(ip => candidates.add(ip));
    } catch(_) {}
    const ips = Array.from(candidates);
    const limit = 48; // balance speed and CPU
    const results = [];
    let idx = 0;
    async function worker() {
      while (idx < ips.length) {
        const my = idx++;
        const ip = ips[my];
        try {
          const printer = await isPrinter(ip);
          if (printer) results.push({ ip });
        } catch {}
      }
    }
    const workers = Array.from({ length: Math.min(limit, ips.length) }, () => worker());
    await Promise.all(workers);
    results.sort((a, b) => parseInt(a.ip.split('.').pop(), 10) - parseInt(b.ip.split('.').pop(), 10));
    return res.json({ subnet: primarySubnet, printers: results });
  } catch (e) {
    // Nunca falha com 500; retorna vazio para o frontend lidar de forma amigável
    return res.json({ subnet: getLocalSubnet(), printers: [] });
  }
}

function readPdfBufferFromPath(relPath) {
  const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
  const safePath = path.normalize(relPath).replace(/^\/+/, '');
  const abs = path.join(uploadsRoot, safePath);
  if (!abs.startsWith(uploadsRoot)) throw new Error('Invalid path');
  if (!fs.existsSync(abs)) throw new Error('Arquivo não encontrado');
  return fs.readFileSync(abs);
}

async function printToIpp(ip, pdfBuffer) {
  const uriCandidates = [
    `ipp://${ip}/ipp/print`,
    `ipp://${ip}:631/ipp/print`,
    `ipp://${ip}:631/` // some printers accept root
  ];
  for (const uri of uriCandidates) {
    try {
      const printer = ipp.Printer(uri);
      await new Promise((resolve, reject) => {
        const msg = {
          "operation-attributes-tag": {
            "requesting-user-name": "retifica-app",
            "job-name": "Orcamento",
            "document-format": "application/pdf"
          },
          data: pdfBuffer
        };
        printer.execute("Print-Job", msg, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      return true;
    } catch (_) { /* try next */ }
  }
  return false;
}

async function printToRaw9100(ip, pdfBuffer) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let finished = false;
    const done = (ok) => { if (finished) return; finished = true; try{ client.destroy(); }catch{} resolve(ok); };
    client.setTimeout(5000);
    client.connect(9100, ip, () => {
      client.write(pdfBuffer, (err) => {
        if (err) return done(false);
        // Some printers require a form feed / PJL, but many accept raw PDF end-of-file
        client.end();
        done(true);
      });
    });
    client.on('timeout', () => done(false));
    client.on('error', () => done(false));
    client.on('close', () => done(true));
  });
}

async function print(req, res) {
  const row = await ensureSingleton();
  if (!row.ip) return res.status(400).json({ error: 'Nenhuma impressora conectada' });

  const { path: relPath, url } = req.body || {};
  if (!relPath && !url) return res.status(400).json({ error: 'Informe o caminho do PDF' });

  try {
    let pdfBuffer;
    if (relPath) {
      pdfBuffer = readPdfBufferFromPath(relPath);
    } else if (url) {
      // Fallback: fetch from URL if provided
      const u = await fetch(url);
      if (!u.ok) throw new Error('Falha ao baixar PDF');
      pdfBuffer = Buffer.from(await u.arrayBuffer());
    }

    // Preferir RAW 9100 (compatível com seu exemplo). Se falhar, tentar IPP.
    let ok = await printToRaw9100(row.ip, pdfBuffer);
    if (!ok) ok = await printToIpp(row.ip, pdfBuffer);
    if (!ok) return res.status(502).json({ error: 'Falha ao enviar para a impressora' });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro ao imprimir' });
  }
}

module.exports = { getCurrent, connect, scan, print };
