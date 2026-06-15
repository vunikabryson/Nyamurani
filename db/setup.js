// db/init.js
const db = require('./connection');

function initDB() {
  console.log('🔄 Initializing database...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('client','rider','admin')),
      status TEXT NOT NULL DEFAULT 'waiting',
      photo TEXT,
      id_number TEXT,
      area TEXT,
      wallet REAL NOT NULL DEFAULT 0,
      loyalty_pts INTEGER NOT NULL DEFAULT 0,
      saved_addresses TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rider_profiles (
      user_id TEXT PRIMARY KEY,
      bike_model TEXT,
      plate_number TEXT,
      license_number TEXT,
      id_number TEXT,
      emergency_name TEXT,
      emergency_phone TEXT,
      contract_signed INTEGER NOT NULL DEFAULT 0,
      contract_date TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      rider_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ Database tables ensured');

  return db;
}

module.exports = initDB;
