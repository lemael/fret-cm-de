const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { parseMessage } = require('../services/parser');

const router = express.Router();

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
      `INSERT INTO shipments (client_id, category, status, tracking_token, raw_message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [client.id, category, 'EN_ATTENTE', trackingToken, rawMessage]
    );

    const baseUrl = process.env.WEB_URL || 'https://votre-fret.vercel.app';
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
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Statut requis' });

  try {
    const result = await pool.query(
      'UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Dossier introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
