const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { parseMessage } = require('../services/parser');

const router = express.Router();

const ALLOWED_PHASES = new Set(['LOADING', 'AT_SEA', 'DISTRIBUTION']);

const inferPhaseFromStatus = (status) => {
  if (['DISTRIBUE', 'LIVRE', 'EN_DISTRIBUTION', 'EN_ATTENTE_DISTRIBUTION'].includes(status)) {
    return 'DISTRIBUTION';
  }
  if (['EN_MER', 'EN_TRANSIT_MARITIME', 'TRACKING_EN_COURS'].includes(status)) {
    return 'AT_SEA';
  }
  return 'LOADING';
};

// POST /api/shipments/parse — analyse un message WhatsApp et crée un dossier
router.post('/parse', auth, async (req, res) => {
  const { phone, name, rawMessage } = req.body;
  if (!phone || !rawMessage) {
    return res.status(400).json({ error: 'Numéro de téléphone et message requis' });
  }

  try {
    // Upsert client par téléphone
    const clientResult = await pool.query(
      `INSERT INTO clients (phone, name) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, clients.name)
       RETURNING *`,
      [phone, name || null]
    );
    const client = clientResult.rows[0];

    const category = parseMessage(rawMessage);
    const trackingToken = uuidv4();

    const shipmentResult = await pool.query(
      `INSERT INTO shipments (client_id, phase, category, status, departure_date, tracking_token, raw_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [client.id, 'LOADING', category, 'EN_ATTENTE_CHARGEMENT', null, trackingToken, rawMessage]
    );

    const baseUrl = process.env.WEB_URL || 'https://ravishing-endurance-production-7ff1.up.railway.app';
    res.status(201).json({
      client,
      shipment: shipmentResult.rows[0],
      statusLink: `${baseUrl}/status/${trackingToken}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/shipments/:id/status — mise à jour du statut
router.patch('/:id/status', auth, async (req, res) => {
  const { status, phase, departureDate } = req.body;
  if (!status) return res.status(400).json({ error: 'Statut requis' });

  const nextPhase = phase || inferPhaseFromStatus(status);
  if (!ALLOWED_PHASES.has(nextPhase)) {
    return res.status(400).json({ error: 'Phase invalide' });
  }

  if (departureDate && Number.isNaN(Date.parse(departureDate))) {
    return res.status(400).json({ error: 'Date de depart invalide' });
  }

  try {
    const result = await pool.query(
      `UPDATE shipments
       SET status = $1,
           phase = $2,
           departure_date = COALESCE($3, departure_date),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, nextPhase, departureDate || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Dossier introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
