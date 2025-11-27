const express = require('express');
const path = require('path');
const multer = require('multer');
const { sendPdfToPrinterEmail } = require('../../controllers/print.controller');
const { auth } = require('../../middlewares/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'pdf');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const base = (file.originalname || 'arquivo.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${ts}-${base}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/email', auth(true), upload.single('pdf'), sendPdfToPrinterEmail);

module.exports = router;
