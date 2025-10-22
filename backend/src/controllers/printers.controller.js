const { z } = require('zod');
const {
  listPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  setDefaultPrinter,
} = require('../services/printers.service');
const net = require('net');
const http = require('http');
const https = require('https');
const { prisma } = require('../db/prisma');

const printerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(200),
  protocol: z.enum(['ipp', 'raw9100']).default('ipp'),
  port: z.number().int().positive().max(65535),
  path: z.string().max(200).optional().nullable(),
  isConnected: z.boolean().optional().default(false),
});

async function list(req, res){
  const items = await listPrinters();
  res.json({ printers: items });
}

async function create(req, res){
  const parsed = printerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const data = parsed.data;
  const force = (req.query && req.query.force === '1') || (req.body && req.body.force === true);
  // Validate connectivity before creating (unless forced)
  if (!force) {
    try {
      const test = await testConnectivityInternal({ host: data.host, protocol: data.protocol, port: data.port, path: data.path });
      if (!test.ok) {
        return res.status(400).json({ error: 'Não foi possível conectar ao dispositivo informado', test });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Falha ao verificar conexão', details: String(e && e.message || e) });
    }
  }
  // Não conectar automaticamente ao adicionar
  const created = await createPrinter({
    name: data.name,
    host: data.host,
    protocol: data.protocol,
    port: data.port,
    path: data.path || null,
    isConnected: false,
  });
  res.status(201).json({ printer: created });
}

async function update(req, res){
  const { id } = req.params;
  const parsed = printerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const updated = await updatePrinter(id, parsed.data);
  res.json({ printer: updated });
}

async function remove(req, res){
  const { id } = req.params;
  await deletePrinter(id);
  res.status(204).send();
}

async function markDefault(req, res){
  const { id } = req.params;
  await setDefaultPrinter(id);
  res.json({ ok: true });
}

module.exports = { list, create, update, remove, markDefault };

// Extra: obter impressora padrão
async function getDefault(req, res){
  const printer = await prisma.printer.findFirst({ where: { isConnected: true } });
  if (!printer) return res.status(404).json({ error: 'Nenhuma impressora padrão definida' });
  res.json({ printer });
}

// Checar conectividade TCP (IPP:631 / RAW:9100)
function checkTcpConnectivity(host, port, timeoutMs = 2000){
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finalize = (ok) => { if (done) return; done = true; try { socket.destroy(); } catch{} resolve(ok); };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finalize(true));
    socket.on('timeout', () => finalize(false));
    socket.on('error', () => finalize(false));
    try { socket.connect(port, host); } catch { finalize(false); }
  });
}

// HTTP(S) GET with timeout (for IPP status endpoints that expose HTTP status)
function httpGetWithTimeout(url, timeoutMs = 2000){
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        // consider 2xx-3xx as success
        const ok = res.statusCode && res.statusCode < 400;
        res.resume(); // drain
        resolve({ ok, status: res.statusCode });
      });
      req.on('timeout', () => { try { req.destroy(new Error('timeout')); } catch{} resolve({ ok: false, status: 0 }); });
      req.on('error', () => resolve({ ok: false, status: 0 }));
    } catch {
      resolve({ ok: false, status: 0 });
    }
  });
}

async function testConnectivityInternal({ host, protocol, port, path }){
  const start = Date.now();
  if (protocol === 'raw9100') {
    const ok = await checkTcpConnectivity(host, port || 9100, 2500);
    const elapsedMs = Date.now() - start;
    return { ok, method: 'tcp', elapsedMs };
  }
  // IPP: try HTTP GET to provided path or /status as common status endpoint
  const ippPath = (path && path.trim()) || '/status';
  const url = `http://${host}:${port || 631}${ippPath.startsWith('/') ? '' : '/'}${ippPath}`;
  const res = await httpGetWithTimeout(url, 2500);
  const elapsedMs = Date.now() - start;
  if (res.ok) return { ok: true, method: 'http', status: res.status, url, elapsedMs };
  // Fallback: try root (some devices return 200 on "/")
  const res2 = await httpGetWithTimeout(`http://${host}:${port || 631}/`, 2500);
  const elapsedMs2 = Date.now() - start;
  return { ok: !!res2.ok, method: 'http', status: res2.status, url: res2.ok ? `http://${host}:${port || 631}/` : url, elapsedMs: res2.ok ? elapsedMs2 : elapsedMs2 };
}

async function statusById(req, res){
  const { id } = req.params;
  const printer = await prisma.printer.findUnique({ where: { id } });
  if (!printer) return res.status(404).json({ error: 'Dispositivo não encontrado' });
  const test = await testConnectivityInternal({ host: printer.host, protocol: printer.protocol, port: printer.port, path: printer.path });
  res.json({ connected: !!test.ok, test, printer: { id: printer.id, host: printer.host, port: printer.port, protocol: printer.protocol, name: printer.name } });
}

async function statusDefault(req, res){
  const printer = await prisma.printer.findFirst({ where: { isConnected: true } });
  if (!printer) return res.json({ connected: false, printer: null });
  const test = await testConnectivityInternal({ host: printer.host, protocol: printer.protocol, port: printer.port, path: printer.path });
  res.json({ connected: !!test.ok, test, printer: { id: printer.id, host: printer.host, port: printer.port, protocol: printer.protocol, name: printer.name } });
}

module.exports.getDefault = getDefault;
module.exports.statusById = statusById;
module.exports.statusDefault = statusDefault;

// New semantics: "connected" (reusing isDefault as connection flag)
async function getConnected(req, res){
  const printer = await prisma.printer.findFirst({ where: { isConnected: true } });
  if (!printer) return res.status(404).json({ error: 'Nenhum dispositivo conectado' });
  res.json({ printer });
}

async function statusConnected(req, res){
  const printer = await prisma.printer.findFirst({ where: { isConnected: true } });
  if (!printer) return res.json({ connected: false, printer: null });
  const test = await testConnectivityInternal({ host: printer.host, protocol: printer.protocol, port: printer.port, path: printer.path });
  res.json({ connected: !!test.ok, test, printer: { id: printer.id, host: printer.host, port: printer.port, protocol: printer.protocol, name: printer.name } });
}

async function connectPrinter(req, res){
  const { id } = req.params;
  const printer = await prisma.printer.findUnique({ where: { id } });
  if (!printer) return res.status(404).json({ error: 'Dispositivo não encontrado' });
  // Validate connectivity server-side
  const test = await testConnectivityInternal({ host: printer.host, protocol: printer.protocol, port: printer.port, path: printer.path });
  if (!test.ok) return res.status(400).json({ error: 'Falha ao conectar ao dispositivo', test });
  // Ensure only one connected
  await prisma.printer.updateMany({ where: { isConnected: true }, data: { isConnected: false } });
  await prisma.printer.update({ where: { id }, data: { isConnected: true, lastUsedAt: new Date() } });
  res.json({ ok: true, connected: true, test });
}

async function disconnectPrinter(req, res){
  const { id } = req.params;
  const printer = await prisma.printer.findUnique({ where: { id } });
  if (!printer) return res.status(404).json({ error: 'Dispositivo não encontrado' });
  if (printer.isConnected) {
    await prisma.printer.update({ where: { id }, data: { isConnected: false } });
  }
  res.json({ ok: true, connected: false });
}

module.exports.getConnected = getConnected;
module.exports.statusConnected = statusConnected;
module.exports.connectPrinter = connectPrinter;
module.exports.disconnectPrinter = disconnectPrinter;

// Public test endpoint: verify connectivity before saving
const testSchema = z.object({
  host: z.string().min(1).max(200),
  protocol: z.enum(['ipp', 'raw9100']).default('ipp'),
  port: z.number().int().positive().max(65535).optional(),
  path: z.string().max(200).optional().nullable(),
});

async function testConnectivity(req, res){
  const parsed = testSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const { host, protocol, port, path } = parsed.data;
  try {
    const test = await testConnectivityInternal({ host, protocol, port, path });
    res.json({ ok: !!test.ok, test });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao testar conexão', details: String(e && e.message || e) });
  }
}

module.exports.testConnectivity = testConnectivity;
