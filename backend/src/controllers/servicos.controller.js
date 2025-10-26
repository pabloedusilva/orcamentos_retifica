const { prisma } = require('../db/prisma');
const { z } = require('zod');

const servicoSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().or(z.literal('')),
  preco: z.number().nonnegative().default(0),
});

async function list(req, res) {
  const servicos = await prisma.servico.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ servicos });
}

async function create(req, res) {
  const parse = servicoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos' });
  const { nome, descricao, preco } = parse.data;
  const servico = await prisma.servico.create({ data: { nome, descricao: descricao || null, preco: Number(preco) } });
  res.status(201).json({ servico });
}

async function update(req, res) {
  const { id } = req.params;
  const parse = servicoSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos' });
  const { nome, descricao, preco } = parse.data;
  const servico = await prisma.servico.update({ where: { id }, data: { nome, descricao: descricao || null, preco: Number(preco) } });
  res.json({ servico });
}

async function remove(req, res) {
  const { id } = req.params;
  await prisma.servico.delete({ where: { id } });
  res.status(204).send();
}

module.exports = { list, create, update, remove };
