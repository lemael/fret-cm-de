const express = require('express');
const pool = require('../config/db');
const { authenticateAny, requireRole } = require('../middleware/auth');

const router = express.Router();

const STAFF_ROLES = new Set(['admin', 'gestionnaire']);

let tableEnsured = false;
const ensureShipmentScheduleTable = async () => {
  if (tableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipment_schedule (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_date DATE NOT NULL,
      notes         TEXT,
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);
  tableEnsured = true;
};

// GET /api/shipment-schedule — calendrier des dates d'envoi (Cameroun → Allemagne).
// Renseigné par l'admin ; le gestionnaire ne fait que le consulter.
router.get('/', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    await ensureShipmentScheduleTable();
    const result = await pool.query('SELECT * FROM shipment_schedule ORDER BY shipment_date ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/shipment-schedule — ajoute une date d'envoi (admin uniquement)
router.post('/', requireRole('admin'), async (req, res) => {
  const { shipmentDate, notes } = req.body;
  if (!shipmentDate || Number.isNaN(Date.parse(shipmentDate))) {
    return res.status(400).json({ error: 'Date invalide' });
  }

  try {
    await ensureShipmentScheduleTable();
    const result = await pool.query(
      'INSERT INTO shipment_schedule (shipment_date, notes) VALUES ($1, $2) RETURNING *',
      [shipmentDate, notes && notes.trim() ? notes.trim() : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/shipment-schedule/:id — supprime une date (admin uniquement)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await ensureShipmentScheduleTable();
    const result = await pool.query(
      'DELETE FROM shipment_schedule WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Date introuvable' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
