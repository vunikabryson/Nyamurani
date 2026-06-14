const express = require('express');
const router = express.Router();

const db = require('../db/connection');
const { auth } = require('../middleware/auth');

router.use(auth);

// ─────────────────────────────
// GET NOTIFICATIONS
// ─────────────────────────────
router.get('/', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const unread_only = req.query.unread_only === 'true';

    let query = 'SELECT * FROM notifications WHERE user_id=?';
    const params = [req.user.id];

    if (unread_only) {
      query += ' AND read_flag=0';
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const notifications = db.prepare(query).all(...params);

    const unread = db.prepare(
      'SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_flag=0'
    ).get(req.user.id).c;

    res.json({
      notifications,
      unread
    });

  } catch (err) {
    console.error('GET NOTIFICATIONS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ─────────────────────────────
// MARK ONE AS READ
// ─────────────────────────────
router.put('/:id/read', (req, res) => {
  try {
    db.prepare(
      'UPDATE notifications SET read_flag=1 WHERE id=? AND user_id=?'
    ).run(req.params.id, req.user.id);

    res.json({ message: 'ok' });

  } catch (err) {
    console.error('MARK READ ERROR:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ─────────────────────────────
// MARK ALL AS READ
// ─────────────────────────────
router.put('/read-all', (req, res) => {
  try {
    db.prepare(
      'UPDATE notifications SET read_flag=1 WHERE user_id=?'
    ).run(req.user.id);

    res.json({ message: 'ok' });

  } catch (err) {
    console.error('READ ALL ERROR:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ─────────────────────────────
// DELETE NOTIFICATION
// ─────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    db.prepare(
      'DELETE FROM notifications WHERE id=? AND user_id=?'
    ).run(req.params.id, req.user.id);

    res.json({ message: 'ok' });

  } catch (err) {
    console.error('DELETE NOTIFICATION ERROR:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ─────────────────────────────
// EVENTS (FIXED + SAFE DATE HANDLING)
// ─────────────────────────────
router.get('/events', (req, res) => {
  try {
    const since = Number(req.query.since || 0);

    const date = new Date(since);

    // SAFE fallback (prevents crash)
    const safeDate =
      isNaN(date.getTime())
        ? new Date(0).toISOString()
        : date.toISOString();

    const events = db.prepare(
      'SELECT * FROM events WHERE created_at > ? ORDER BY created_at ASC LIMIT 30'
    ).all(safeDate);

    res.json({
      events,
      serverTime: Date.now()
    });

  } catch (err) {
    console.error('EVENTS ERROR:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

module.exports = router;
