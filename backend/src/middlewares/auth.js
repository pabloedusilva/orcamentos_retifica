const jwt = require('jsonwebtoken');

function parseCookie(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > -1) {
      const k = p.slice(0, idx).trim();
      const v = decodeURIComponent(p.slice(idx + 1).trim());
      out[k] = v;
    }
  });
  return out;
}

function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookies = parseCookie(req.headers.cookie || '');
  if (cookies.access_token) return cookies.access_token;
  return null;
}

function auth(required = true, options = {}) {
  const mode = options.mode || 'json'; // 'json' | 'redirect'
  return (req, res, next) => {
    const token = getTokenFromReq(req);
    if (!token) {
      if (!required) return next();
      return mode === 'redirect' ? res.redirect('/login') : res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const issuer = process.env.JWT_ISSUER || 'orcamentos-api';
      const audience = process.env.JWT_AUDIENCE || 'web';
      const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer, audience });
      req.user = { id: payload.sub, role: payload.role };
      return next();
    } catch (e) {
      return mode === 'redirect' ? res.redirect('/login') : res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = { auth };
