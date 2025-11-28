// Load env from project root to ensure DATABASE_URL and seed creds
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco...');

  // ===============================
  // CRIAR USUÁRIO ADMINISTRADOR
  // ===============================
  const username = process.env.SEED_ADMIN_USER || 'admin';
  const password = process.env.SEED_ADMIN_PASS || 'admin12345';
  const passwordHash = await bcrypt.hash(password, 10);

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (!existingUser) {
    await prisma.user.create({ 
      data: { 
        username, 
        passwordHash, 
        role: 'admin'
      } 
    });
    console.log(`✅ Usuário admin criado -> username: '${username}', password: '${password}'`);
  } else {
    console.log(`ℹ️  Usuário '${username}' já existe.`);
  }

  console.log('🎉 Seed concluído com sucesso!');
  
  // ===============================
  // RESUMO FINAL
  // ===============================
  const resumo = {
    usuarios: await prisma.user.count(),
    clientes: await prisma.cliente.count(),
    pecas: await prisma.peca.count(),
    servicos: await prisma.servico.count(),
    orcamentos: await prisma.orcamento.count(),
    configuracoes: await prisma.configuracoes.count()
  };
  
  console.log('\n📊 RESUMO DO BANCO:');
  console.log(`   👥 Usuários: ${resumo.usuarios}`);
  console.log(`   👤 Clientes: ${resumo.clientes}`);
  console.log(`   🔧 Peças: ${resumo.pecas}`);
  console.log(`   🛠️  Serviços: ${resumo.servicos}`);
  console.log(`   📋 Orçamentos: ${resumo.orcamentos}`);
  console.log(`   ⚙️  Configurações: ${resumo.configuracoes}`);
}

main().catch((e) => {
  console.error('❌ Erro durante o seed:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
