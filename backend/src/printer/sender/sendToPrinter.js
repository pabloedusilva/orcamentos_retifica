const net = require('net');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function sendChunksWithBackpressure(socket, chunks, timeoutMs) {
  return new Promise((resolve, reject) => {
    let idx = 0;
    let done = false;
    let timer = null;

    const armTimeout = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!done) reject(new Error('Timeout de envio'));
      }, timeoutMs);
    };

    const writeNext = () => {
      if (idx >= chunks.length) {
        done = true;
        if (timer) clearTimeout(timer);
        return resolve();
      }
      armTimeout();
      const canWrite = socket.write(chunks[idx], (err) => {
        if (err) return reject(err);
      });
      idx++;
      if (canWrite) {
        // continuar imediatamente
        setImmediate(writeNext);
      }
      // se não puder escrever, esperar 'drain'
    };

    socket.once('error', reject);
    socket.on('drain', () => { if (!done) writeNext(); });
    writeNext();
  });
}

async function sendToPrinter({ host, port, chunks, connectTimeoutMs = 8000, socketTimeoutMs = 15000, maxRetries = 2, retryDelayMs = 1000, logger }) {
  let attempt = 0;
  while (true) {
    attempt++;
    const socket = new net.Socket();
    let connected = false;
    const connectPromise = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('Timeout de conexão')), connectTimeoutMs);
      socket.connect(port, host, () => {
        clearTimeout(to);
        connected = true;
        socket.setTimeout(socketTimeoutMs);
        resolve();
      });
      socket.once('error', (e) => {
        clearTimeout(to);
        reject(e);
      });
      socket.once('timeout', () => {
        reject(new Error('Socket timeout'));
      });
    });

    try {
      logger?.info(`Conectando em ${host}:${port} (tentativa ${attempt})`);
      await connectPromise;
      logger?.info('Conexão estabelecida');
      await sendChunksWithBackpressure(socket, chunks, socketTimeoutMs);
      socket.end();
      logger?.info('Envio concluído e conexão encerrada');
      return { ok: true };
    } catch (e) {
      try { if (connected) socket.end(); else socket.destroy(); } catch {}
      logger?.error('Falha no envio', { attempt, error: String(e && e.message || e) });
      if (attempt > maxRetries) {
        return { ok: false, error: e?.message || 'Erro ao enviar para impressora' };
      }
      await delay(retryDelayMs);
    }
  }
}

module.exports = { sendToPrinter };
