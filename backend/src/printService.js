const path = require('path');
const fs = require('fs');
const cfg = require('./printer/config/printerConfig');
const { getDailyLogger } = require('./printer/utils/logger');
const { chunkBuffer } = require('./printer/utils/chunk');
const { rasterizePdf, adjustAndGray, floydSteinbergDither } = require('./printer/rasterizer/rasterizePdf');
const { toProtocolPages } = require('./printer/converter/toEscpRaster');
const { sendToPrinter } = require('./printer/sender/sendToPrinter');

async function processPrint(pdfPath) {
  const logger = getDailyLogger(cfg.logsDir);
  logger.info('Iniciando job de impressão', { pdfPath, dpi: cfg.dpi, protocol: cfg.protocol });

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    logger.error('PDF inexistente');
    return { ok: false, error: 'PDF não encontrado' };
  }

  // 1) Rasterizar PDF
  const pages = await rasterizePdf(pdfPath, cfg.dpi);
  logger.info('Rasterização concluída', { pages: pages.length });

  // 2) Ajuste e dithering -> 1-bit
  const bwPages = pages.map((p) => {
    const gray = adjustAndGray(p.data, cfg.contrast, cfg.brightness);
    const { bitmap, bytesPerLine } = cfg.dither ? floydSteinbergDither(gray, p.width, p.height) : floydSteinbergDither(gray, p.width, p.height);
    return { width: p.width, height: p.height, bytesPerLine, bitmap };
  });
  logger.info('Conversão para 1-bit concluída');

  // 3) Converter para protocolo ESC/P-R (ou ESC/P2)
  const pageBuffers = toProtocolPages(bwPages, cfg.protocol);
  const printBuffer = Buffer.concat(pageBuffers);
  logger.info('Conversão para protocolo concluída', { totalBytes: printBuffer.length });

  // 4) Dividir em chunks e enviar via TCP 9100
  const chunks = chunkBuffer(printBuffer, cfg.chunkSize);
  logger.info('Divisão em chunks preparada', { chunks: chunks.length, chunkSize: cfg.chunkSize });

  const sendRes = await sendToPrinter({
    host: cfg.printerIp,
    port: cfg.printerPort,
    chunks,
    connectTimeoutMs: cfg.connectTimeoutMs,
    socketTimeoutMs: cfg.socketTimeoutMs,
    maxRetries: cfg.maxRetries,
    retryDelayMs: cfg.retryDelayMs,
    logger
  });

  if (!sendRes.ok) {
    logger.error('Falha na impressão', { error: sendRes.error });
    return { ok: false, error: sendRes.error };
  }

  logger.info('Impressão finalizada com sucesso');
  return { ok: true, pages: pages.length, bytes: printBuffer.length };
}

module.exports = { processPrint };
