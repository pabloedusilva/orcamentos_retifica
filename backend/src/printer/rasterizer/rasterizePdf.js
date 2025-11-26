const fs = require('fs');
const path = require('path');
let createCanvas;
let ImageData;
try {
  const { Canvas, ImageData: SKImageData } = require('skia-canvas');
  createCanvas = (w, h) => new Canvas(w, h);
  ImageData = SKImageData;
} catch (e) {
  const c = require('canvas');
  createCanvas = c.createCanvas;
  ImageData = c.ImageData;
}
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Renderiza PDF em imagens raster (RGBA) página por página
// Retorna: [{ width, height, data: Uint8ClampedArray(RGBA), pageIndex }]
async function rasterizePdf(pdfPath, dpi = 300) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF não encontrado: ${pdfPath}`);
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;

  const out = [];
  const scale = dpi / 72; // 72 user units por inch

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const renderContext = {
      canvasContext: ctx,
      viewport
    };
    await page.render(renderContext).promise;

    const image = ctx.getImageData(0, 0, width, height);
    out.push({ width, height, data: image.data, pageIndex: i - 1 });
  }

  return out;
}

// Ajuste de contraste e brilho simples em escala de cinza
function adjustAndGray(bufferRGBA, contrast = 1.0, brightness = 0.0) {
  const out = new Uint8ClampedArray(bufferRGBA.length / 4);
  for (let i = 0, j = 0; i < bufferRGBA.length; i += 4, j++) {
    // Conversão para luminância
    let r = bufferRGBA[i];
    let g = bufferRGBA[i + 1];
    let b = bufferRGBA[i + 2];
    let a = bufferRGBA[i + 3] / 255;
    // Transparência vira branco
    if (a < 0.5) { r = 255; g = 255; b = 255; }
    let y = 0.299 * r + 0.587 * g + 0.114 * b;
    // Normaliza [0,1]
    y = y / 255;
    // Contraste (em torno de 0.5) e brilho (-1..1)
    y = (y - 0.5) * contrast + 0.5 + brightness;
    if (y < 0) y = 0; if (y > 1) y = 1;
    out[j] = Math.round(y * 255);
  }
  return out;
}

// Dither Floyd–Steinberg para 1-bit
function floydSteinbergDither(gray, width, height) {
  const arr = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) arr[i] = gray[i];
  const threshold = 128;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = arr[idx];
      const newVal = old < threshold ? 0 : 255;
      const err = old - newVal;
      arr[idx] = newVal;

      // difundir erro
      if (x + 1 < width) arr[idx + 1] += err * (7 / 16);
      if (y + 1 < height) {
        if (x > 0) arr[idx + width - 1] += err * (3 / 16);
        arr[idx + width] += err * (5 / 16);
        if (x + 1 < width) arr[idx + width + 1] += err * (1 / 16);
      }
    }
  }

  // Empacotar em 1-bit por pixel (linha por linha, MSB->LSB)
  const bytesPerLine = Math.ceil(width / 8);
  const bitmap = Buffer.alloc(bytesPerLine * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const bit = arr[idx] < threshold ? 1 : 0; // 1 = preto
      const byteIndex = y * bytesPerLine + (x >> 3);
      const bitPos = 7 - (x & 7);
      if (bit) bitmap[byteIndex] |= (1 << bitPos);
    }
  }
  return { bitmap, bytesPerLine };
}

module.exports = { rasterizePdf, adjustAndGray, floydSteinbergDither };
