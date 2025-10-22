const { prisma } = require('../db/prisma');
const { z } = require('zod');
// const { generateOrcamentoPdf } = require('../utils/pdf/generate'); // Desabilitado temporariamente
const path = require('path');

// Função para gerar ID customizado: DDMMYYYY-NN
async function generateOrcamentoId() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const datePrefix = `${day}${month}${year}`;
  
  // Buscar orçamentos do dia atual
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  
  const todayOrcamentos = await prisma.orcamento.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Encontrar o próximo número sequencial
  let maxNumber = 0;
  todayOrcamentos.forEach(orc => {
    if (orc.id.startsWith(datePrefix)) {
      const parts = orc.id.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });
  
  const nextNumber = String(maxNumber + 1).padStart(2, '0');
  return `${datePrefix}-${nextNumber}`;
}

const itemSchema = z.object({
  nome: z.string().min(1),
  quantidade: z.number().int().positive(),
  preco: z.number().nonnegative(),
  tipo: z.enum(['peca', 'servico'])
});

const orcSchema = z.object({
  clienteId: z.string().min(1),
  data: z.string().or(z.date()),
  dataFinal: z.string().optional().or(z.date().optional()),
  status: z.enum(['pendente', 'aprovado']).default('pendente'),
  carro: z.string().optional(),
  placa: z.string().optional(),
  incEst: z.string().optional(),
  observacao: z.string().optional(),
  items: z.array(itemSchema).min(1)
});

async function list(req, res) {
  const orcamentos = await prisma.orcamento.findMany({
    orderBy: { createdAt: 'desc' },
    include: { cliente: true, items: true }
  });
  res.json({ orcamentos });
}

async function create(req, res) {
  const parsed = orcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });

  const data = parsed.data;
  const customId = await generateOrcamentoId();
  const total = data.items.reduce((acc, it) => acc + (Number(it.preco) * Number(it.quantidade)), 0);
  const created = await prisma.orcamento.create({
    data: {
      id: customId,
      clienteId: data.clienteId,
      data: new Date(data.data),
      dataFinal: data.dataFinal ? new Date(data.dataFinal) : null,
      status: data.status,
      carro: data.carro || null,
      placa: data.placa || null,
      incEst: data.incEst || null,
      observacao: data.observacao || null,
      total,
      items: { create: data.items.map(it => ({
        nome: it.nome,
        quantidade: Number(it.quantidade),
        preco: Number(it.preco),
        tipo: it.tipo
      })) }
    },
    include: { cliente: true, items: true }
  });
  res.status(201).json({ orcamento: created });
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pendente', 'aprovado'].includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const updated = await prisma.orcamento.update({ where: { id }, data: { status } });
  res.json({ orcamento: updated });
}

async function update(req, res) {
  const { id } = req.params;
  const parsed = orcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const data = parsed.data;
  const total = data.items.reduce((acc, it) => acc + (Number(it.preco) * Number(it.quantidade)), 0);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.orcamentoItem.deleteMany({ where: { orcamentoId: id } });
    return tx.orcamento.update({
      where: { id },
      data: {
        clienteId: data.clienteId,
        data: new Date(data.data),
        dataFinal: data.dataFinal ? new Date(data.dataFinal) : null,
        status: data.status,
        carro: data.carro || null,
        placa: data.placa || null,
        incEst: data.incEst || null,
        observacao: data.observacao || null,
        total,
        items: { create: data.items.map(it => ({ nome: it.nome, quantidade: Number(it.quantidade), preco: Number(it.preco), tipo: it.tipo })) }
      },
      include: { cliente: true, items: true }
    });
  });
  res.json({ orcamento: updated });
}
async function remove(req, res) {
  const { id } = req.params;
  await prisma.orcamento.delete({ where: { id } });
  res.status(204).send();
}

async function pdf(req, res) {
  const { id } = req.params;
  const orc = await prisma.orcamento.findUnique({ where: { id }, include: { cliente: true, items: true } });
  if (!orc) return res.status(404).json({ error: 'Orçamento não encontrado' });
  // PDF generation temporariamente desabilitado - usar frontend para gerar PDFs
  return res.status(501).json({ error: 'Geração de PDF via backend temporariamente indisponível. Use o frontend.' });
  // const filePath = await generateOrcamentoPdf(orc);
  // res.download(filePath, path.basename(filePath));
}

module.exports = { list, create, updateStatus, update, remove, pdf };
