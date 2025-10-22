const fs = require('fs');
const path = require('path');

function ensureUploadDirs() {
  const root = path.join(__dirname, '..', '..');
  const uploads = path.join(root, 'uploads');
  const images = path.join(uploads, 'images');
  const pdf = path.join(uploads, 'pdf');
  [uploads, images, pdf].forEach((p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); });
}

module.exports = { ensureUploadDirs };
