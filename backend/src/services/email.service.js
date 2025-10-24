const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

/**
 * Cria transportador de e-mail usando as configurações do .env
 */
function createTransporter(emailConfig) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outros
    auth: {
      user: emailConfig.email, // E-mail da configuração da empresa
      pass: process.env.SMTP_PASSWORD // Senha do e-mail (do .env por segurança)
    }
  });
}

/**
 * Gera o HTML do e-mail de forma limpa e minimalista
 */
function generateEmailHTML(orcamentoId, clienteNome, pdfUrl, logoDataUrl) {
  const logoHtml = logoDataUrl 
    ? `<img src="${logoDataUrl}" alt="Janio Retífica" style="max-width: 150px; height: auto; margin-bottom: 20px;" />`
    : '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orçamento - Janio Retífica</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <!-- Header com logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #E0B84E 0%, #B48E2A 100%); padding: 40px 30px; text-align: center;">
              ${logoHtml}
              <h1 style="margin: 10px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 600;">Janio Retífica</h1>
            </td>
          </tr>
          
          <!-- Conteúdo -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 24px; font-weight: 600;">Olá, ${clienteNome}!</h2>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Segue em anexo o orçamento <strong>#${orcamentoId}</strong> conforme solicitado.
              </p>
              <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Caso tenha alguma dúvida ou necessite de mais informações, estamos à disposição.
              </p>
              
              <!-- Botão de download alternativo -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${pdfUrl}" style="display: inline-block; background: linear-gradient(135deg, #E0B84E 0%, #B48E2A 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                      📄 Visualizar Orçamento Online
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <em>Caso não consiga abrir o anexo, você pode acessar o orçamento pelo link acima.</em>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #111827; font-size: 16px; font-weight: 600;">Janio Retífica</p>
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Especialistas em retífica automotiva<br>
                Qualidade e excelência em cada serviço
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Texto legal -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin-top: 20px;">
          <tr>
            <td style="text-align: center; color: #9ca3af; font-size: 12px; line-height: 1.6;">
              Este e-mail foi enviado automaticamente. Por favor, não responda.<br>
              © ${new Date().getFullYear()} Janio Retífica. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Envia e-mail com o PDF do orçamento
 */
async function sendOrcamentoEmail({ 
  toEmail, 
  toName, 
  orcamentoId, 
  pdfPath, 
  pdfUrl, 
  senderEmail, 
  logoDataUrl 
}) {
  try {
    // Validar e-mail do destinatário
    if (!toEmail || !toEmail.includes('@')) {
      throw new Error('E-mail do destinatário inválido');
    }

    // Validar e-mail do remetente
    if (!senderEmail || !senderEmail.includes('@')) {
      throw new Error('E-mail do remetente não configurado');
    }

    // Criar transportador
    const transporter = createTransporter({ email: senderEmail });

    // Verificar se o arquivo existe
    const fullPdfPath = path.join(__dirname, '..', '..', 'uploads', pdfPath);
    if (!fs.existsSync(fullPdfPath)) {
      throw new Error('Arquivo PDF não encontrado');
    }

    // Preparar HTML do e-mail
    const htmlContent = generateEmailHTML(orcamentoId, toName, pdfUrl, logoDataUrl);

    // Configurar e-mail
    const mailOptions = {
      from: {
        name: 'Janio Retífica',
        address: senderEmail
      },
      to: {
        name: toName,
        address: toEmail
      },
      subject: `Orçamento #${orcamentoId} - Janio Retífica`,
      html: htmlContent,
      attachments: [
        {
          filename: `orcamento-${orcamentoId}.pdf`,
          path: fullPdfPath,
          contentType: 'application/pdf'
        }
      ]
    };

    // Enviar e-mail
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    throw error;
  }
}

module.exports = {
  sendOrcamentoEmail
};
