const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/status/:token — route publique, pas d'auth
router.get('/:token', async (req, res) => {
  // Validation simple du format UUID pour éviter les injections
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(req.params.token)) {
    return res.status(404).json({ error: 'Lien invalide' });
  }

  try {
    const result = await pool.query(
      `SELECT s.category, s.status, s.created_at, s.updated_at,
              c.name, c.phone
       FROM shipments s
       JOIN clients c ON c.id = s.client_id
       WHERE s.tracking_token = $1`,
      [req.params.token]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Lien invalide ou expiré' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
