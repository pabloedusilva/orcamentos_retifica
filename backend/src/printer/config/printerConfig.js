const path = require('path');

function parseBool(v, def = false) {
  if (v === undefined || v === null) return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

module.exports = {
  printerIp: process.env.PRINTER_IP || '192.168.0.50',
  printerPort: parseInt(process.env.PRINTER_PORT || '9100', 10),
  // 300 DPI conforme solicitado
  dpi: parseInt(process.env.PRINTER_DPI || '300', 10),
  // Tamanho dos chunks (bytes)
  chunkSize: Math.max(1024, parseInt(process.env.PRINTER_CHUNK_SIZE || String(8 * 1024), 10)),
  // Timeouts e tentativas
  socketTimeoutMs: Math.max(5000, parseInt(process.env.PRINTER_SOCKET_TIMEOUT_MS || '15000', 10)),
  connectTimeoutMs: Math.max(2000, parseInt(process.env.PRINTER_CONNECT_TIMEOUT_MS || '8000', 10)),
  maxRetries: Math.max(0, parseInt(process.env.PRINTER_MAX_RETRIES || '2', 10)),
  retryDelayMs: Math.max(250, parseInt(process.env.PRINTER_RETRY_DELAY_MS || '1000', 10)),
  // Conversão e imagem
  dither: parseBool(process.env.PRINTER_DITHER, true),
  contrast: Math.min(2.0, Math.max(0.5, parseFloat(process.env.PRINTER_CONTRAST || '1.0'))),
  brightness: Math.min(1.0, Math.max(-1.0, parseFloat(process.env.PRINTER_BRIGHTNESS || '0.0'))),
  // Protocolo de saída: 'escpr' (ESC/P-R) ou 'escp2' (compatibilidade). Padrão 'escpr'.
  protocol: (process.env.PRINTER_PROTOCOL || 'escpr').toLowerCase(),
  // Pasta de logs
  logsDir: path.join(__dirname, '..', '..', '..', 'logs')
};
