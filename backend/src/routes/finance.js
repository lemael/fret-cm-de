const express = require('express');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const auth = requireRole('gestionnaire');

const ALLOWED_TYPES = new Set(['COLLECTE', 'COMMISSION', 'REVERSEMENT']);

let transactionsTableEnsured = false;
const ensureTransactionsTable = async () => {
  if (transactionsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id       UUID REFERENCES shipments(id) ON DELETE SET NULL,
      gestionnaire_id   UUID REFERENCES gestionnaires(id) ON DELETE SET NULL,
      amount            NUMERIC(12,2) NOT NULL,
      commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      type              VARCHAR(20) NOT NULL CHECK (type IN ('COLLECTE','COMMISSION','REVERSEMENT')),
      status            VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (status IN ('EN_ATTENTE','VALIDE','ANNULE')),
      notes             TEXT,
      created_at        TIMESTAMP DEFAULT NOW()
    )
  `);
  transactionsTableEnsured = true;
};

// GET /api/finance/overview — totaux + transactions récentes
router.get('/overview', auth, async (_req, res) => {
  try {
    await ensureTransactionsTable();

    const [totalsResult, recentResult] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE type = 'COLLECTE' AND status = 'VALIDE'), 0) AS total_collected,
           COALESCE(SUM(commission_amount) FILTER (WHERE status = 'VALIDE'), 0) AS total_commission,
           COALESCE(SUM(amount) FILTER (WHERE type = 'REVERSEMENT' AND status = 'VALIDE'), 0) AS total_reversed
         FROM transactions`
      ),
      pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50'),
    ]);

    res.json({
      totals: totalsResult.rows[0],
      transactions: recentResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/finance/transactions — le gestionnaire enregistre une entrée
router.post('/transactions', auth, async (req, res) => {
  const { amount, commissionAmount, type, shipmentId, notes } = req.body;

  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'Type de transaction invalide' });
  }
  if (Number.isNaN(Number(amount))) {
    return res.status(400).json({ error: 'Montant invalide' });
  }

  try {
    await ensureTransactionsTable();

    const result = await pool.query(
      `INSERT INTO transactions (shipment_id, gestionnaire_id, amount, commission_amount, type, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'VALIDE', $6) RETURNING *`,
      [shipmentId || null, req.gestionnaire.id, amount, commissionAmount || 0, type, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
