const { prisma } = require('../db/prisma');
const { z } = require('zod');

const clienteSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  documento: z.string().optional().or(z.literal('')),
  endereco: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal('')),
  cep: z.string().optional().or(z.literal(''))
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
  try {
    await prisma.cliente.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    // Prisma foreign key constraint
    const code = err && err.code;
    if (code === 'P2003') {
      const force = String(req.query.force || '').toLowerCase();
      if (force === '1' || force === 'true') {
        // Forçar exclusão em cascata: orçamentos e itens do cliente
        await prisma.$transaction(async (tx) => {
          const orcs = await tx.orcamento.findMany({ where: { clienteId: id }, select: { id: true } });
          const ids = orcs.map(o => o.id);
          if (ids.length) {
            await tx.orcamentoItem.deleteMany({ where: { orcamentoId: { in: ids } } });
            await tx.orcamento.deleteMany({ where: { id: { in: ids } } });
          }
          await tx.cliente.delete({ where: { id } });
        });
        return res.status(204).send();
      }
      return res.status(409).json({
        error: 'Não é possível excluir o cliente: existem orçamentos vinculados.',
        code: 'CLIENTE_COM_ORCAMENTOS',
        suggestion: 'Exclua os orçamentos do cliente ou confirme exclusão forçada com ?force=1'
      });
    }
    console.error('Erro ao excluir cliente:', err);
    return res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
}

module.exports = { list, create, update, remove };
