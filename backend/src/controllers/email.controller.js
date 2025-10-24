const { sendOrcamentoEmail } = require('../services/email.service');
const { prisma } = require('../db/prisma');

/**
 * POST /api/v1/email/send-orcamento
 * Envia orçamento por e-mail
 */
async function sendOrcamento(req, res, next) {
  try {
    const {
      clienteEmail,
      clienteNome,
      orcamentoId,
      pdfPath,
      pdfUrl
    } = req.body;

    // Validações
    if (!clienteEmail) {
      return res.status(400).json({ 
        error: 'E-mail do cliente é obrigatório' 
      });
    }

    if (!clienteNome) {
      return res.status(400).json({ 
        error: 'Nome do cliente é obrigatório' 
      });
    }

    if (!orcamentoId) {
      return res.status(400).json({ 
        error: 'ID do orçamento é obrigatório' 
      });
    }

    if (!pdfPath || !pdfUrl) {
      return res.status(400).json({ 
        error: 'Caminho do PDF é obrigatório' 
      });
    }

    // Buscar configurações da empresa (e-mail remetente e logo)
    const settings = await prisma.configuracoes.findFirst();
    
    if (!settings || !settings.email) {
      return res.status(400).json({ 
        error: 'E-mail da empresa não configurado. Configure nas Configurações.' 
      });
    }

    // Validar se tem senha SMTP configurada no .env
    if (!process.env.SMTP_PASSWORD) {
      return res.status(500).json({ 
        error: 'Servidor de e-mail não configurado. Entre em contato com o administrador.' 
      });
    }

    // Enviar e-mail
    const result = await sendOrcamentoEmail({
      toEmail: clienteEmail,
      toName: clienteNome,
      orcamentoId: orcamentoId,
      pdfPath: pdfPath,
      pdfUrl: pdfUrl,
      senderEmail: settings.email,
      logoDataUrl: settings.logoDataUrl || ''
    });

    res.json({
      success: true,
      message: 'E-mail enviado com sucesso',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    
    // Mensagens de erro mais amigáveis
    let errorMessage = 'Erro ao enviar e-mail. Tente novamente.';
    
    if (error.message.includes('EAUTH') || error.message.includes('authentication')) {
      errorMessage = 'Falha na autenticação do e-mail. Verifique as configurações.';
    } else if (error.message.includes('ECONNECTION') || error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Não foi possível conectar ao servidor de e-mail.';
    } else if (error.message.includes('recipient')) {
      errorMessage = 'E-mail do destinatário inválido.';
    } else if (error.message.includes('PDF não encontrado')) {
      errorMessage = 'Arquivo PDF não encontrado. Tente gerar novamente.';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = {
  sendOrcamento
};
