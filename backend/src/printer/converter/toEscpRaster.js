// Conversão para linguagem de impressão baseada em comandos ESC.
// Suporta dois modos:
//  - 'escpr'  : ESC/P-R básico (job/page init + raster lines + FF)
//  - 'escp2'  : Compatibilidade ESC/P 24-pin (ESC * m nL nH data) em bandas de 24 linhas
// OBS: Alguns modelos aceitam ambos; ajuste via config.protocol.

const ESC = 0x1B;
const FF = 0x0C;

function esc(...vals) {
  return Buffer.from(vals);
}

function uint16le(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

// Modo ESC/P-R (básico) – sequência comum: reset, iniciar modo raster, enviar linhas, form feed
// Nota: Implementação pragmática; alguns modelos podem demandar comandos adicionais.
function buildEscprPage({ width, height, bytesPerLine, bitmap }) {
  const parts = [];
  // Reset
  parts.push(esc(ESC, 0x40)); // ESC @

  // Entrar em modo raster (sequência genérica ESC ( U .../ ESC ( G ... varia por modelo)
  // Aqui usamos uma combinação neutra e seguimos com dados de imagem por linhas.
  // Comando fictício de setup suave (não prejudica modelos que ignoram): ESC ( U 1 0 0
  parts.push(Buffer.from([ESC, 0x28, 0x55, 0x01, 0x00, 0x00]));

  // Envio linha a linha usando comando gráfico por linha (ESC ( g ... )
  // Estrutura: ESC ( g pL pH m xL xH data
  // Onde m=0 simples; x = bytes da linha
  for (let y = 0; y < height; y++) {
    const line = bitmap.subarray(y * bytesPerLine, (y + 1) * bytesPerLine);
    const x = line.length;
    const pL = (x + 3) & 0xFF; // m(1) + x(2) + data(x)
    const pH = ((x + 3) >> 8) & 0xFF;
    parts.push(Buffer.from([ESC, 0x28, 0x67, pL, pH, 0x00, x & 0xFF, (x >> 8) & 0xFF]));
    parts.push(line);
  }

  // Ejetar página
  parts.push(Buffer.from([FF]));
  return Buffer.concat(parts);
}

// Modo ESC/P 24-pin (ESC * m) – envia em bandas de 24 linhas
function buildEscp2Page({ width, height, bytesPerLine, bitmap }) {
  const parts = [];
  // Reset
  parts.push(esc(ESC, 0x40));

  const bandHeight = 24;
  const bytesPerBandLine = Math.ceil(width / 8);
  const columns = bytesPerBandLine; // cada coluna = 8 pixels horizontais

  for (let y = 0; y < height; y += bandHeight) {
    const band = Buffer.alloc(columns * bandHeight);
    // Empacotar verticalmente 24 pontos por coluna
    for (let x = 0; x < width; x++) {
      for (let dy = 0; dy < bandHeight; dy++) {
        const yy = y + dy;
        if (yy >= height) break;
        const srcByteIndex = yy * bytesPerLine + (x >> 3);
        const srcBit = 7 - (x & 7);
        const bit = (bitmap[srcByteIndex] >> srcBit) & 1; // 1 = preto
        if (bit) {
          const col = x >> 3; // coluna
          const dstIndex = col + dy * columns;
          const dstBit = 7 - (x & 7);
          band[dstIndex] |= (1 << dstBit);
        }
      }
    }

    // ESC * m nL nH data – m=33 (24-dot double density)
    const nL = columns & 0xFF;
    const nH = (columns >> 8) & 0xFF;
    parts.push(Buffer.from([ESC, 0x2A, 33, nL, nH]));
    parts.push(band);
    // Nova linha
    parts.push(Buffer.from([0x0A]));
  }

  parts.push(Buffer.from([FF]));
  return Buffer.concat(parts);
}

function toProtocolPages(pages, protocol) {
  return pages.map((p) => {
    if (protocol === 'escp2') return buildEscp2Page(p);
    return buildEscprPage(p);
  });
}

module.exports = { toProtocolPages };
