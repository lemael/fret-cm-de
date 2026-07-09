const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const requireAdmin = requireRole('admin');
const requireGestionnaire = requireRole('gestionnaire');

const ALLOWED_TYPES = new Set(['LOST', 'NON_CONFORME', 'AUTRE']);
const ALLOWED_STATUSES = new Set(['OPEN', 'IN_REVIEW', 'RESOLVED']);

let disputesTableEnsured = false;
const ensureDisputesTable = async () => {
  if (disputesTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS disputes (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      type        VARCHAR(20) NOT NULL DEFAULT 'AUTRE' CHECK (type IN ('LOST','NON_CONFORME','AUTRE')),
      description TEXT,
      status      VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED')),
      resolution  TEXT,
      resolved_by UUID REFERENCES gestionnaires(id) ON DELETE SET NULL,
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  disputesTableEnsured = true;
};

// POST /api/disputes — l'admin signale un litige sur un dossier existant
router.post('/', requireAdmin, async (req, res) => {
  const { shipmentId, type, description } = req.body;
  if (!shipmentId) {
    return res.status(400).json({ error: 'Dossier requis' });
  }
  const normalizedType = ALLOWED_TYPES.has(type) ? type : 'AUTRE';

  try {
    await ensureDisputesTable();

    const shipmentResult = await pool.query('SELECT id FROM shipments WHERE id = $1', [shipmentId]);
    if (!shipmentResult.rows[0]) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    const result = await pool.query(
      `INSERT INTO disputes (shipment_id, type, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [shipmentId, normalizedType, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/disputes — file des litiges pour le gestionnaire
router.get('/', requireGestionnaire, async (_req, res) => {
  try {
    await ensureDisputesTable();

    const result = await pool.query(
      `SELECT d.*, s.tracking_token, s.category, c.name AS client_name, c.phone AS client_phone
       FROM disputes d
       JOIN shipments s ON s.id = d.shipment_id
       JOIN clients c ON c.id = s.client_id
       ORDER BY d.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/disputes/:id — le gestionnaire fait avancer/résout un litige
router.patch('/:id', requireGestionnaire, async (req, res) => {
  const { status, resolution } = req.body;
  if (status && !ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  try {
    await ensureDisputesTable();

    const result = await pool.query(
      `UPDATE disputes
       SET status = COALESCE($1, status),
           resolution = COALESCE($2, resolution),
           resolved_by = CASE WHEN $1 = 'RESOLVED' THEN $3 ELSE resolved_by END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status || null, resolution || null, req.gestionnaire.id, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Litige introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
