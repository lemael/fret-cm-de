const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/clients
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients/:id  — détail client + ses dossiers
router.get('/:id', auth, async (req, res) => {
  try {
    const clientResult = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [req.params.id]
    );
    if (!clientResult.rows[0]) {
      return res.status(404).json({ error: 'Client introuvable' });
    }

    const shipmentsResult = await pool.query(
      'SELECT * FROM shipments WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({ client: clientResult.rows[0], shipments: shipmentsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/clients — création ou mise à jour par téléphone
router.post('/', auth, async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'Numéro de téléphone requis' });

  try {
    const result = await pool.query(
      `INSERT INTO clients (phone, name) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, clients.name)
       RETURNING *`,
      [phone, name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
