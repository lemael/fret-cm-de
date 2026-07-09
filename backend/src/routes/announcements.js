const express = require('express');
const pool = require('../config/db');
const { authenticateAny } = require('../middleware/auth');

const router = express.Router();

const STAFF_ROLES = new Set(['admin', 'gestionnaire']);

let announcementsTableEnsured = false;
const ensureAnnouncementsTable = async () => {
  if (announcementsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(150) NOT NULL,
      body        TEXT NOT NULL,
      author_role VARCHAR(15) NOT NULL CHECK (author_role IN ('ADMIN','GESTIONNAIRE')),
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  announcementsTableEnsured = true;
};

// GET /api/announcements — visible par les 3 profils
router.get('/', authenticateAny, async (_req, res) => {
  try {
    await ensureAnnouncementsTable();
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/announcements — admin ou gestionnaire
router.post('/', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { title, body } = req.body;
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: 'Titre et texte requis' });
  }

  try {
    await ensureAnnouncementsTable();
    const result = await pool.query(
      `INSERT INTO announcements (title, body, author_role) VALUES ($1, $2, $3) RETURNING *`,
      [title.trim(), body.trim(), req.user.role.toUpperCase()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
