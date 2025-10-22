const { prisma } = require('../db/prisma');
const { z } = require('zod');

const clienteSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal(''))
});

async function list(req, res) {
  const clientes = await prisma.cliente.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ clientes });
}

async function create(req, res) {
  const parse = clienteSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos' });
  const cliente = await prisma.cliente.create({ data: parse.data });
  res.status(201).json({ cliente });
}

async function update(req, res) {
  const { id } = req.params;
  const parse = clienteSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Dados inválidos' });
  const cliente = await prisma.cliente.update({ where: { id }, data: parse.data });
  res.json({ cliente });
}

async function remove(req, res) {
  const { id } = req.params;
  await prisma.cliente.delete({ where: { id } });
  res.status(204).send();
}

module.exports = { list, create, update, remove };
