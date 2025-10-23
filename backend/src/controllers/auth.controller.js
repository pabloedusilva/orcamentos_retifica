const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db/prisma');
const { z } = require('zod');

const loginSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9._-]{3,32}$/),
  password: z.string().min(8).max(128)
});

async function login(req, res) {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  const { username, password } = parse.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // Account lockout config from env
  const LOCK_THRESHOLD = parseInt(process.env.AUTH_LOCK_THRESHOLD || '7', 10);
  const LOCK_MINUTES = parseInt(process.env.AUTH_LOCK_MINUTES || '3', 10);

  // Check if account is currently locked
  if (user.lockUntil && user.lockUntil > new Date()) {
    const msLeft = user.lockUntil.getTime() - Date.now();
    const secsLeft = Math.ceil(msLeft / 1000);
    return res.status(423).json({ error: 'Account locked', retryAfterSeconds: secsLeft });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    // increment failed attempts
    const failed = (user.failedLoginAttempts || 0) + 1;
  const update = { failedLoginAttempts: failed };
    if (failed >= LOCK_THRESHOLD) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      update.lockUntil = until;
    }
    await prisma.user.update({ where: { id: user.id }, data: update });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Successful login: reset counters if needed
  if (user.failedLoginAttempts || user.lockUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockUntil: null } });
  }

  const issuer = process.env.JWT_ISSUER || 'orcamentos-api';
  const audience = process.env.JWT_AUDIENCE || 'web';
  const expiresIn = process.env.JWT_EXPIRES_IN || '2d';
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, role: user.role, iss: issuer, aud: audience, iat: now, nbf: now };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  // Also set HttpOnly cookie for server-side protection of HTML routes
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const secureCookie = (process.env.NODE_ENV === 'production') || process.env.ENFORCE_HTTPS === 'true';
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: twoDaysMs
  });

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
}

async function me(req, res) {
  const id = req.user?.id;
  if (!id) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true } });
  res.json({ user });
}

function logout(req, res) {
  // Clear HttpOnly auth cookie (must match cookie options)
  const secureCookie = (process.env.NODE_ENV === 'production') || process.env.ENFORCE_HTTPS === 'true';
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/'
  });
  return res.json({ ok: true });
}

module.exports = { login, me, logout };
