const { prisma } = require('../db/prisma');
const { z } = require('zod');

const pecaSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().or(z.literal('')),
});

async function list(req, res) {
  const pecas = await prisma.peca.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ pecas });
}

async function create(req, res) {
  const parse = pecaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos' });
  const peca = await prisma.peca.create({ data: parse.data });
  res.status(201).json({ peca });
}

async function update(req, res) {
  const { id } = req.params;
  const parse = pecaSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos' });
  const peca = await prisma.peca.update({ where: { id }, data: parse.data });
  res.json({ peca });
}

async function remove(req, res) {
  const { id } = req.params;
  await prisma.peca.delete({ where: { id } });
  res.status(204).send();
}

module.exports = { list, create, update, remove };
