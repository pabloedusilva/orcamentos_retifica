const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}

function ts() {
  return new Date().toISOString();
}

class Logger {
  constructor(filePath) {
    this.filePath = filePath;
    ensureDir(path.dirname(filePath));
  }

  write(line) {
    const out = `[${ts()}] ${line}\n`;
    try { fs.appendFileSync(this.filePath, out); } catch {}
    console.log(out.trim());
  }

  info(msg, meta) { this.write(`INFO: ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`); }
  warn(msg, meta) { this.write(`WARN: ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`); }
  error(msg, meta) { this.write(`ERROR: ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`); }
}

function getDailyLogger(logsDir, prefix = 'print') {
  const day = new Date();
  const name = `${prefix}-${day.getFullYear()}${String(day.getMonth()+1).padStart(2,'0')}${String(day.getDate()).padStart(2,'0')}.log`;
  return new Logger(path.join(logsDir, name));
}

module.exports = { Logger, getDailyLogger };
