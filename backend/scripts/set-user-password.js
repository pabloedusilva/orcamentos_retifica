require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const prisma = new PrismaClient();
  try {
    const username = process.env.USERNAME || process.argv[2];
    const newPass = process.env.PASSWORD || process.argv[3];
    if (!username || !newPass) {
      console.error('Usage: USERNAME=<user> PASSWORD=<newpass> node scripts/set-user-password.js');
      process.exit(1);
    }
    if (newPass.length < 8) {
      console.error('Password must be at least 8 characters to satisfy login policy.');
      process.exit(2);
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`User '${username}' not found.`);
      process.exit(3);
    }
    const passwordHash = await bcrypt.hash(newPass, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log(`Password updated for user '${username}'.`);
  } catch (e) {
    console.error('Error updating password:', e);
    process.exit(4);
  }
})();
