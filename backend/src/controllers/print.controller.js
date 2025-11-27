const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

async function sendPdfToPrinterEmail(req, res) {
  try {
    const toEmail = process.env.PRINTER_EMAIL;
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!toEmail || !gmailUser || !gmailPass) {
      return res.status(400).json({ error: 'Email configuration missing (PRINTER_EMAIL, GMAIL_USER, GMAIL_APP_PASSWORD).' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required (field name: pdf).' });
    }

    const filePath = req.file.path;
    const fileName = path.basename(filePath);

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass }
    });

    const mailOptions = {
      from: gmailUser,
      to: toEmail,
      subject: '', // empty subject to avoid printers adding header pages
      text: '',    // empty body to avoid any body printing
      html: '',
      // Explicit envelope without subject/body
      envelope: { from: gmailUser, to: toEmail },
      attachments: [
        { filename: fileName, path: filePath, contentType: 'application/pdf' }
      ]
    };

    await transporter.sendMail(mailOptions);

    // Clean up file optionally
    try { fs.unlinkSync(filePath); } catch {}

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Failed to send email.' });
  }
}

module.exports = { sendPdfToPrinterEmail };
