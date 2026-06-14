const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const db = require('../db/connection');
const { auth, admin } = require('../middleware/auth');
const { sendSMS } = require('../middleware/sms');
const { safe, pushNotif, audit } = require('../middleware/helpers');

// ─────────────────────────────
// SAFE MIDDLEWARE WRAPPER
// prevents Render crashes if auth/admin throw
// ─────────────────────────────
router.use((req, res, next) => {
  try {
    return auth(req, res, (err) => {
      if (err) return next(err);
      return admin(req, res, next);
    });
  } catch (e) {
    console.error('Auth/Admin middleware error:', e);
    return res.status(401).json({ error: 'Unauthorized access' });
  }
});

// ─────────────────────────────
// OVERVIEW
// ─────────────────────────────
router.get('/overview', (req, res) => {
  try {
    const r = {
      totalOrders: db.prepare("SELECT COUNT(*) c FROM orders").get().c,
      delivered: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='delivered'").get().c,
      pending: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='pending'").get().c,
      inTransit: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='in-transit'").get().c,
      cancelled: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='cancelled'").get().c,
      revenue: db.prepare("SELECT COALESCE(SUM(total_price),0) r FROM orders WHERE status='delivered'").get().r,
      totalRiders: db.prepare("SELECT COUNT(*) c FROM users WHERE role='rider'").get().c,
      activeRiders: db.prepare("SELECT COUNT(*) c FROM users WHERE role='rider' AND status='active'").get().c,
      totalClients: db.prepare("SELECT COUNT(*) c FROM users WHERE role='client'").get().c,
      waitingApproval: db.prepare("SELECT COUNT(*) c FROM users WHERE status='waiting'").get().c,
      recentOrders: db.prepare(`
        SELECT o.*,c.name client_name,r.name rider_name
        FROM orders o
        JOIN users c ON o.client_id=c.id
        LEFT JOIN users r ON o.rider_id=r.id
        ORDER BY o.created_at DESC LIMIT 6
      `).all(),
      recentRegs: db.prepare(`
        SELECT id,name,email,phone,role,status,created_at
        FROM users
        WHERE status='waiting'
        ORDER BY created_at DESC LIMIT 20
      `).all(),
    };

    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Overview failed' });
  }
});

// ─────────────────────────────
// USERS LIST
// ─────────────────────────────
router.get('/users', (req, res) => {
  try {
    const { role, status, limit = 100, offset = 0 } = req.query;

    let q = `
      SELECT u.*,rp.bike_model,rp.plate_number,rp.rating,
      rp.deliveries,rp.total_earnings,rp.commission_rate
      FROM users u
      LEFT JOIN rider_profiles rp ON u.id=rp.user_id
      WHERE u.role!='admin'
    `;

    const p = [];

    if (role) {
      q += ' AND u.role=?';
      p.push(role);
    }

    if (status) {
      q += ' AND u.status=?';
      p.push(status);
    }

    q += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    p.push(Number(limit), Number(offset));

    const users = db.prepare(q).all(...p).map(safe);

    const total = db.prepare(
      "SELECT COUNT(*) c FROM users WHERE role!='admin'"
    ).get().c;

    res.json({ users, total });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Users fetch failed' });
  }
});

// ─────────────────────────────
// USER BY ID
// ─────────────────────────────
router.get('/users/:id', (req, res) => {
  try {
    const u = db.prepare(`
      SELECT u.*,rp.*
      FROM users u
      LEFT JOIN rider_profiles rp ON u.id=rp.user_id
      WHERE u.id=?
    `).get(req.params.id);

    if (!u) return res.status(404).json({ error: 'Not found' });

    const orders = db.prepare(`
      SELECT COUNT(*) cnt,COALESCE(SUM(total_price),0) spent
      FROM orders
      WHERE client_id=? OR rider_id=?
    `).get(u.id, u.id);

    res.json({ user: safe(u), orders });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'User fetch failed' });
  }
});

// ─────────────────────────────
// APPROVE USER (SAFE SMS)
// ─────────────────────────────
router.post('/users/:id/approve', async (req, res) => {
  try {
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!u) return res.status(404).json({ error: 'Not found' });

    db.prepare("UPDATE users SET status='active',updated_at=datetime('now') WHERE id=?")
      .run(u.id);

    audit(req.user.id, req.user.name, 'approved', u.id, u.name, u.role);

    pushNotif(u.id, 'Account Approved!', 'Your account is approved!', '✅', 'approval');

    try {
      await sendSMS(
        u.phone,
        `[NYAMURANI] Hi ${u.name.split(' ')[0]}! Your account is APPROVED.`
      );
    } catch (smsErr) {
      console.error('SMS failed:', smsErr.message);
    }

    res.json({ message: 'Approved' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// ─────────────────────────────
// EVENTS (FIXED DATE BUG)
// ─────────────────────────────
router.get('/events', (req, res) => {
  try {
    const since = Number(req.query.since || 0);
    const sinceDate = new Date(since || 0).toISOString();

    const events = db.prepare(`
      SELECT * FROM events
      WHERE created_at > ?
      ORDER BY created_at ASC
      LIMIT 50
    `).all(sinceDate);

    res.json({ events, serverTime: Date.now() });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Events failed' });
  }
});

// ─────────────────────────────
// DEFAULT ERROR SAFE EXPORT
// ─────────────────────────────
module.exports = router;
