const express = require('express');
const pool = require('../config/db');
const { authenticateAny } = require('../middleware/auth');
const { createNotification } = require('../db/ensureTables');

const router = express.Router();

let messagesTableEnsured = false;
const ensureMessagesTable = async () => {
  if (messagesTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('CLIENT','ADMIN')),
      body        TEXT NOT NULL,
      is_read     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  messagesTableEnsured = true;
};

// Vérifie que l'utilisateur authentifié a le droit d'accéder à ce dossier,
// et renvoie le dossier (avec son client) si c'est le cas.
const loadAuthorizedShipment = async (req, res) => {
  const shipmentResult = await pool.query(
    'SELECT s.*, c.name AS client_name, c.phone AS client_phone FROM shipments s JOIN clients c ON c.id = s.client_id WHERE s.id = $1',
    [req.params.shipmentId]
  );
  const shipment = shipmentResult.rows[0];
  if (!shipment) {
    res.status(404).json({ error: 'Dossier introuvable' });
    return null;
  }

  if (req.user.role === 'client' && shipment.client_id !== req.user.id) {
    res.status(403).json({ error: 'Accès refusé' });
    return null;
  }

  if (req.user.role !== 'client' && req.user.role !== 'admin') {
    res.status(403).json({ error: 'Accès refusé' });
    return null;
  }

  return shipment;
};

// GET /api/messages/:shipmentId — fil de messages d'un dossier
router.get('/:shipmentId', authenticateAny, async (req, res) => {
  try {
    await ensureMessagesTable();
    const shipment = await loadAuthorizedShipment(req, res);
    if (!shipment) return;

    const result = await pool.query(
      'SELECT * FROM messages WHERE shipment_id = $1 ORDER BY created_at ASC',
      [shipment.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/messages/:shipmentId — envoyer un message (rendez-vous, réclamation, ...)
router.post('/:shipmentId', authenticateAny, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message vide' });
  }

  try {
    await ensureMessagesTable();
    const shipment = await loadAuthorizedShipment(req, res);
    if (!shipment) return;

    const senderRole = req.user.role.toUpperCase();
    const result = await pool.query(
      `INSERT INTO messages (shipment_id, client_id, sender_role, body)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [shipment.id, shipment.client_id, senderRole, text.trim()]
    );

    if (senderRole === 'CLIENT') {
      await createNotification({
        type: 'NEW_MESSAGE',
        title: 'Nouveau message client',
        body: `${shipment.client_name || shipment.client_phone} a envoyé un message.`,
        relatedShipmentId: shipment.id,
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
