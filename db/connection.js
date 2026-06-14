require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────
// SAFE DB PATH (Render-compatible)
// ─────────────────────────────
const dbPath =
  process.env.DB_PATH ||
  path.join(__dirname, '../db/nyamurani.db');

// ─────────────────────────────
// ENSURE DIRECTORY EXISTS
// ─────────────────────────────
const dir = path.dirname(dbPath);
if (dir && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─────────────────────────────
// INIT DB SAFELY
// ─────────────────────────────
let db;

try {
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

} catch (err) {
  console.error('❌ DATABASE INIT FAILED:', err.message);
  process.exit(1);
}

module.exports = db;
