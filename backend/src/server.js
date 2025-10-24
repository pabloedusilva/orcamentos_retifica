require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const serveStatic = require('serve-static');
const jwt = require('jsonwebtoken');

const { router: api } = require('./routes');
const { ensureUploadDirs } = require('./utils/paths');
const { errorHandler } = require('./middlewares/error');
const { auth } = require('./middlewares/auth');

const app = express();

// Trust proxy for deployment behind reverse proxy
app.set('trust proxy', 1);

// Compression middleware for better performance
app.use(compression());

// Security headers with CSP for frontend
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://dailyverses.net"],
      scriptSrcAttr: ["'unsafe-inline'"], // Permite event handlers inline (onclick, etc)
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://worldtimeapi.org", "https://nominatim.openstreetmap.org", "https://viacep.com.br", "https://cdnjs.cloudflare.com", "https://dailyverses.net"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allows cross-origin resources for maps/APIs
  crossOriginResourcePolicy: false, // Desabilita CORP
  crossOriginOpenerPolicy: false // Desabilita COOP
}));

// Remove qualquer header COEP que possa ter sido definido
app.use((req, res, next) => {
  res.removeHeader('Cross-Origin-Embedder-Policy');
  res.removeHeader('Cross-Origin-Resource-Policy');
  res.removeHeader('Cross-Origin-Opener-Policy');
  next();
});

// Parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// CORS
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// Logs
const isDev = process.env.NODE_ENV !== 'production';
if (isDev) app.use(morgan('dev'));

// Rate limit (basic) for auth and API
const limiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Auth-specific stricter rate limit (configurable via env)
// Defaults: 10 minute window, max 7 attempts, skip successful requests
const parseBool = (v) => {
  if (v === undefined || v === null) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const AUTH_RATE_DISABLED = parseBool(process.env.AUTH_RATE_DISABLED);
const AUTH_WINDOW_MIN = Math.max(1, parseInt(process.env.AUTH_RATE_WINDOW_MIN || '10', 10));
const AUTH_MAX_ATTEMPTS = Math.max(1, parseInt(process.env.AUTH_RATE_MAX || '7', 10));

let authLimiter = (req, res, next) => next();
if (!AUTH_RATE_DISABLED) {
  authLimiter = rateLimit({
    windowMs: AUTH_WINDOW_MIN * 60 * 1000,
    max: AUTH_MAX_ATTEMPTS,
    // Generic error message (do not expose thresholds or timing)
    message: { error: 'Too many login attempts, please try again later.' },
    standardHeaders: true, // Send RateLimit-* headers
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful logins
  });
}

// Attach limiter to the login path. Using `use` with the exact path
// ensures it runs before the nested router handles the request.
app.use('/api/v1/auth/login', authLimiter);

// General rate limit for all frontend routes
const frontendLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 page loads per minute
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/', '/login'], frontendLimiter);

// Optional HTTPS enforcement (honors proxies when behind a platform)
if (process.env.ENFORCE_HTTPS === 'true') {
  app.enable('trust proxy');
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.status(400).json({ error: 'HTTPS required' });
  });
}

// Additional security middleware
app.use((req, res, next) => {
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  // Additional security headers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  next();
});

// Block suspicious requests
app.use((req, res, next) => {
  const suspiciousPatterns = [
    /\.(php|asp|jsp|cgi)$/i,
    /\/(wp-admin|admin|administrator)/i,
    /\.(env|git|sql|bak)$/i,
    /(union|select|insert|delete|drop|create|alter)/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.path) || pattern.test(req.query.toString())
  );
  
  if (isSuspicious) {
    return res.status(403).json({ error: 'Forbidden request pattern' });
  }
  
  next();
});

// Static assets (uploads, pdfs)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes (before frontend routes)
app.use('/api', api);

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// Serve frontend static files with security
const frontendPath = path.join(__dirname, '..', '..', 'frontend');

// Serve static assets with proper headers and caching
app.use('/assets', express.static(path.join(frontendPath, 'assets'), {
  dotfiles: 'deny',
  setHeaders: (res, filePath) => {
    // Security headers for static files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Cache control based on file type
    if (filePath.match(/\.(css|js)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day for CSS/JS
      res.setHeader('Content-Type', filePath.endsWith('.css') ? 'text/css' : 'application/javascript');
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days for images
    }
  }
}));

// Serve other frontend files (img, video, manifest, etc.)
app.use(express.static(frontendPath, {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // No cache for HTML files, cache for assets
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg|webp|mp4|webm)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
    } else if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

// Clean URL routing for frontend pages
// Protect main app with server-side auth (cookie or header)
app.get('/', auth(true, { mode: 'redirect' }), (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/login', (req, res) => {
  // If token is valid, redirect to app; else show login
  try {
    const header = req.headers.authorization || '';
    let token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      const m = (req.headers.cookie || '').match(/(?:^|;\s*)access_token=([^;]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }
    if (token) {
      const issuer = process.env.JWT_ISSUER || 'orcamentos-api';
      const audience = process.env.JWT_AUDIENCE || 'web';
      jwt.verify(token, process.env.JWT_SECRET, { issuer, audience });
      return res.redirect('/');
    }
  } catch (_) {}
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(frontendPath, 'auth', 'login.html'));
});

// Prevent access to auth folder and other sensitive paths
app.get('/auth*', (req, res) => {
  res.redirect('/login');
});

// Handle client-side routing for SPA (redirect unknown routes to main app)
app.get('*', (req, res) => {
  // Only handle client-side routes (no API/file)
  if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
    // Validate token; redirect if missing/invalid
    try {
      const header = req.headers.authorization || '';
      let token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        const m = (req.headers.cookie || '').match(/(?:^|;\s*)access_token=([^;]+)/);
        if (m) token = decodeURIComponent(m[1]);
      }
      if (!token) return res.redirect('/login');
      const issuer = process.env.JWT_ISSUER || 'orcamentos-api';
      const audience = process.env.JWT_AUDIENCE || 'web';
      jwt.verify(token, process.env.JWT_SECRET, { issuer, audience });
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.sendFile(path.join(frontendPath, 'index.html'));
    } catch (_) {
      return res.redirect('/login');
    }
  }
  return res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use(errorHandler);

// Boot
const PORT = process.env.PORT || 3001;
ensureUploadDirs();
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});
