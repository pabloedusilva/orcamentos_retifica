const { prisma } = require('../db/prisma');

// GET /api/v1/settings - Buscar configurações da empresa
async function getSettings(req, res, next) {
  try {
    // Buscar a primeira (e única) entrada de configurações
    let settings = await prisma.configuracoes.findFirst();
    
    // Se não existir, criar vazio
    if (!settings) {
      settings = await prisma.configuracoes.create({
        data: {
          nome: '',
          endereco: '',
          telefone: '',
          email: '',
          cnpj: '',
          cep: '',
          logoDataUrl: '',
          logoPreset: '',
          uploadedLogos: '[]'
        }
      });
    }

    // Parse do JSON de uploadedLogos
    const responseData = {
      ...settings,
      selectedLogo: settings.selectedLogo || '',
      uploadedLogos: settings.uploadedLogos ? JSON.parse(settings.uploadedLogos) : []
    };

    res.json(responseData);
  } catch (error) {
    console.error('Error in getSettings:', error);
    next(error);
  }
}

// PUT /api/v1/settings - Atualizar configurações da empresa
async function updateSettings(req, res, next) {
  try {
    const {
      nome,
      endereco,
      telefone,
      email,
      cnpj,
      cep,
      logoDataUrl,
      logoPreset,
      selectedLogo,
      uploadedLogos
    } = req.body;

    // Buscar settings existente
    let settings = await prisma.configuracoes.findFirst();

    const data = {
      nome: nome || '',
      endereco: endereco || '',
      telefone: telefone || '',
      email: email || '',
      cnpj: cnpj || '',
      cep: cep || '',
      logoDataUrl: logoDataUrl || '',
      logoPreset: logoPreset || '',
      selectedLogo: selectedLogo || '',
      uploadedLogos: JSON.stringify(uploadedLogos || [])
    };

    if (settings) {
      // Atualizar existente
      settings = await prisma.configuracoes.update({
        where: { id: settings.id },
        data
      });
    } else {
      // Criar novo
      settings = await prisma.configuracoes.create({ data });
    }

    const responseData = {
      ...settings,
      selectedLogo: settings.selectedLogo || '',
      uploadedLogos: settings.uploadedLogos ? JSON.parse(settings.uploadedLogos) : []
    };

    res.json(responseData);
  } catch (error) {
    console.error('Error in updateSettings:', error);
    next(error);
  }
}

// GET /api/v1/settings/user - Buscar dados do usuário autenticado
async function getUserInfo(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error in getUserInfo:', error);
    next(error);
  }
}

// PUT /api/v1/settings/account - Atualizar conta do usuário
async function updateAccount(req, res, next) {
  try {
    // Expect plaintext passwords: { username?, oldPassword?, newPassword? }
    const { username, oldPassword, newPassword } = req.body || {};
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Buscar usuário atual
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updateData = {};

    // Username change (optional) - basic validation
    if (typeof username === 'string' && username.trim()) {
      updateData.username = username.trim();
    }

    // Password change: if newPassword provided, require oldPassword and validate server-side
    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Para alterar a senha é necessário informar a senha atual.' });
      }

      // Validate basic password rules server-side
      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 8 caracteres.' });
      }

      const bcrypt = require('bcryptjs');

      // Verify old password
      const match = await bcrypt.compare(oldPassword, currentUser.passwordHash || '');
      if (!match) {
        // Do not reveal whether the user exists/password specifics
        // Use 403 Forbidden so the client is not treated as unauthenticated
        return res.status(403).json({ error: 'Senha atual incorreta.' });
      }

      // Hash new password with bcrypt (recommended salt rounds)
      const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
      const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      updateData.passwordHash = newHash;
    }

    // If nothing to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // OPTIONAL: create a simple audit log entry in console (could be persisted to DB later)
    try {
      console.info(`Account updated: userId=${userId} fields=${Object.keys(updateData).join(',')}`);
    } catch (e) {}

    res.json(user);
  } catch (error) {
    console.error('Error in updateAccount:', error);
    next(error);
  }
}

// DELETE /api/v1/settings - Limpar todas as configurações (reset para vazio)
async function clearSettings(req, res, next) {
  try {
    // Apagar todas as configurações existentes
    await prisma.configuracoes.deleteMany();
    // Retornar payload vazio padrão (frontend preencherá com campos em branco)
    return res.status(204).send();
  } catch (error) {
    console.error('Error in clearSettings:', error);
    next(error);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  getUserInfo,
  updateAccount,
  clearSettings
};
