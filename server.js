require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const fs        = require('fs');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────
// SECURITY
// ─────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const origins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origins.includes('*') || origins.includes(origin)) {
      return cb(null, true);
    }
    return cb(null, true); // keep permissive for now (avoid CORS breaking deploy)
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

// ─────────────────────────────
// BODY PARSER
// ─────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────
// RATE LIMITING
// ─────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests' }
}));

app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many auth attempts' }
}));

// ─────────────────────────────
// STATIC FILES
// ─────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use('/uploads', express.static(uploadDir));

// ─────────────────────────────
// FRONTEND (optional)
// ─────────────────────────────
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ─────────────────────────────
// ROOT ROUTE (IMPORTANT FIX)
// ─────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'Nyamurani API is running 🚀',
    health: '/health',
    api: '/api'
  });
});

// ─────────────────────────────
// HEALTH CHECK
// ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Nyamurani API',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// ─────────────────────────────
// API ROUTES
// ─────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/riders',        require('./routes/riders'));

// ─────────────────────────────
// 404 HANDLER (CLEAN VERSION)
// ─────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// ─────────────────────────────
// ERROR HANDLER
// ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────
// START SERVER (RENDER SAFE)
// ─────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
