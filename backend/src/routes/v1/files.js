const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../../middlewares/auth');
const { ensureUploadDirs } = require('../../utils/paths');

ensureUploadDirs();

const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads');
const imagesDir = path.join(uploadDir, 'images');
const pdfDir = path.join(uploadDir, 'pdf');

// Storage para imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, imagesDir); },
  filename: function (req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`;
    cb(null, unique);
  }
});

// Storage para PDFs (organizados por data DD-MM-YYYY)
const pdfStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateFolder = `${day}-${month}-${year}`;
    const datePath = path.join(pdfDir, dateFolder);
    
    // Criar pasta da data se não existir
    if (!fs.existsSync(datePath)) {
      fs.mkdirSync(datePath, { recursive: true });
    }
    
    cb(null, datePath);
  },
  filename: function (req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, safe);
  }
});

const upload = multer({ storage, limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10') * 1024 * 1024) } });
const pdfUpload = multer({ storage: pdfStorage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB para PDFs

router.post('/image', auth(true), upload.single('image'), (req, res) => {
  res.status(201).json({ url: `/uploads/images/${req.file.filename}` });
});

router.post('/pdf', auth(true), pdfUpload.single('pdf'), (req, res) => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateFolder = `${day}-${month}-${year}`;
  
  res.status(201).json({ 
    url: `/uploads/pdf/${dateFolder}/${req.file.filename}`,
    path: `pdf/${dateFolder}/${req.file.filename}`,
    filename: req.file.filename,
    date: dateFolder
  });
});

module.exports = router;
