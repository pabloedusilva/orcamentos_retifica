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
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, imagesDir); },
  filename: function (req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`;
    cb(null, unique);
  }
});

const upload = multer({ storage, limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10') * 1024 * 1024) } });

router.post('/image', auth(true), upload.single('image'), (req, res) => {
  res.status(201).json({ url: `/uploads/images/${req.file.filename}` });
});

module.exports = router;
