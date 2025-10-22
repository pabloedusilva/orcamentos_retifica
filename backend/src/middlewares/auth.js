const jwt = require('jsonwebtoken');

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return required ? res.status(401).json({ error: 'Unauthorized' }) : next();

    try {
      const issuer = process.env.JWT_ISSUER || 'orcamentos-api';
      const audience = process.env.JWT_AUDIENCE || 'web';
      const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer, audience });
      req.user = { id: payload.sub, role: payload.role };
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = { auth };
