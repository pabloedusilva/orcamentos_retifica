const path = require('path');
const fs = require('fs');
const { processPrint } = require('./printService');
const { z } = require('zod');

const bodySchema = z.object({
  pdfPath: z.string().min(1)
});

async function printHandler(req, res) {
  const parse = bodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Payload inválido. Envie { pdfPath }.' });

  const { pdfPath } = parse.data;
  try {
    const result = await processPrint(pdfPath);
    if (!result.ok) return res.status(500).json(result);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Falha na impressão' });
  }
}

module.exports = { printHandler };
