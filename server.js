require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const initDB = require('./db/init'); // 👈 ADD THIS

// ✅ STEP 1: INIT DB BEFORE ANY ROUTES
const db = initDB();

const app = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────
// SECURITY
// ─────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: '*',
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
  max: 500
}));

// ─────────────────────────────
// STATIC FILES
// ─────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use('/uploads', express.static(uploadDir));

// ─────────────────────────────
// ROUTES
// ─────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/riders', require('./routes/riders'));

// ─────────────────────────────
// HEALTH CHECK
// ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Nyamurani API',
    db: 'ready',
    time: new Date().toISOString()
  });
});

// ─────────────────────────────
// START SERVER (ONLY AFTER DB READY)
// ─────────────────────────────
function startServer() {
  try {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📦 DB is initialized and ready`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
