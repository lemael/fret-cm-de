const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const auth = requireRole('client');

let columnEnsured = false;
const ensureLastSeenColumn = async () => {
  if (columnEnsured) return;
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_announcement_seen_at TIMESTAMP');
  columnEnsured = true;
};

// GET /api/client-notifications — fusionne messages non lus + annonces non vues
router.get('/', auth, async (req, res) => {
  try {
    await ensureLastSeenColumn();

    const [unreadMessagesResult, clientResult] = await Promise.all([
      pool.query(
        `SELECT DISTINCT ON (m.shipment_id)
           m.shipment_id, m.body, m.created_at
         FROM messages m
         JOIN shipments s ON s.id = m.shipment_id
         WHERE s.client_id = $1 AND m.sender_role != 'CLIENT' AND m.is_read = FALSE
         ORDER BY m.shipment_id, m.created_at DESC`,
        [req.client.id]
      ),
      pool.query('SELECT last_announcement_seen_at FROM clients WHERE id = $1', [req.client.id]),
    ]);

    const lastSeen = clientResult.rows[0]?.last_announcement_seen_at || new Date(0).toISOString();
    const unreadAnnouncementsResult = await pool.query(
      'SELECT id, title, body, created_at FROM announcements WHERE created_at > $1 ORDER BY created_at DESC',
      [lastSeen]
    );

    const messageItems = unreadMessagesResult.rows.map((row) => ({
      type: 'MESSAGE',
      id: row.shipment_id,
      shipmentId: row.shipment_id,
      title: 'Nouveau message',
      body: row.body,
      createdAt: row.created_at,
    }));

    const announcementItems = unreadAnnouncementsResult.rows.map((row) => ({
      type: 'ANNOUNCEMENT',
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
    }));

    const items = [...messageItems, ...announcementItems].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({ unreadCount: items.length, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/client-notifications/mark-announcements-seen
router.patch('/mark-announcements-seen', auth, async (req, res) => {
  try {
    await ensureLastSeenColumn();
    await pool.query('UPDATE clients SET last_announcement_seen_at = NOW() WHERE id = $1', [req.client.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
