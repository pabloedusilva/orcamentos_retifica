const { prisma } = require('../db/prisma');

async function listPrinters() {
  const items = await prisma.printer.findMany({ orderBy: [{ isConnected: 'desc' }, { name: 'asc' }] });
  return items;
}

async function createPrinter(data) {
  // If setting as connected, unset previous connections
  if (data.isConnected) {
    await prisma.printer.updateMany({ data: { isConnected: false }, where: { isConnected: true } });
  }
  const created = await prisma.printer.create({ data });
  return created;
}

async function updatePrinter(id, data) {
  if (data.isConnected) {
    await prisma.printer.updateMany({ data: { isConnected: false }, where: { isConnected: true, NOT: { id } } });
  }
  const updated = await prisma.printer.update({ where: { id }, data });
  return updated;
}

async function deletePrinter(id) {
  await prisma.printer.delete({ where: { id } });
}

async function setDefaultPrinter(id) {
  await prisma.$transaction([
    prisma.printer.updateMany({ data: { isConnected: false }, where: { isConnected: true } }),
    prisma.printer.update({ where: { id }, data: { isConnected: true } })
  ]);
}

async function getDefaultPrinter() {
  return prisma.printer.findFirst({ where: { isConnected: true } });
}

module.exports = {
  listPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  setDefaultPrinter,
  getDefaultPrinter,
};
