require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany();
    console.log('Usuários no banco:', users);
  } catch (e) {
    console.error('Erro ao listar usuários:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
