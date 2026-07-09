const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { ensureNotificationsTable } = require('../db/ensureTables');

const router = express.Router();

// GET /api/notifications — cloche admin
router.get('/', auth, async (_req, res) => {
  try {
    await ensureNotificationsTable();

    const [listResult, unreadResult] = await Promise.all([
      pool.query(
        `SELECT n.*, s.client_id
         FROM notifications n
         LEFT JOIN shipments s ON s.id = n.related_shipment_id
         ORDER BY n.created_at DESC
         LIMIT 50`
      ),
      pool.query('SELECT COUNT(*) FROM notifications WHERE is_read = FALSE'),
    ]);

    res.json({
      notifications: listResult.rows,
      unreadCount: Number(unreadResult.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', auth, async (_req, res) => {
  try {
    await ensureNotificationsTable();
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    await ensureNotificationsTable();
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Notification introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
