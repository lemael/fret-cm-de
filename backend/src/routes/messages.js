const express = require('express');
const pool = require('../config/db');
const { authenticateAny } = require('../middleware/auth');
const { createNotification } = require('../db/ensureTables');

const router = express.Router();

const STAFF_ROLES = new Set(['admin', 'gestionnaire']);

let messagesTableEnsured = false;
const ensureMessagesTable = async () => {
  if (messagesTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      sender_role VARCHAR(15) NOT NULL CHECK (sender_role IN ('CLIENT','ADMIN','GESTIONNAIRE')),
      body        TEXT NOT NULL,
      is_read     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  messagesTableEnsured = true;
};

// Vérifie que l'utilisateur authentifié a le droit d'accéder à ce dossier,
// et renvoie le dossier (avec son client) si c'est le cas. Admin et
// gestionnaire partagent le même fil — n'importe lequel des deux peut
// répondre à un client.
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

  if (req.user.role !== 'client' && !STAFF_ROLES.has(req.user.role)) {
    res.status(403).json({ error: 'Accès refusé' });
    return null;
  }

  return shipment;
};

// GET /api/messages — file des conversations pour l'admin et le gestionnaire
router.get('/', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    await ensureMessagesTable();

    const result = await pool.query(`
      SELECT DISTINCT ON (m.shipment_id)
        m.shipment_id,
        s.tracking_token,
        c.id AS client_id,
        c.name AS client_name,
        c.phone AS client_phone,
        m.body AS last_message_body,
        m.sender_role AS last_message_sender_role,
        m.created_at AS last_message_at
      FROM messages m
      JOIN shipments s ON s.id = m.shipment_id
      JOIN clients c ON c.id = m.client_id
      ORDER BY m.shipment_id, m.created_at DESC
    `);

    result.rows.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/messages/:shipmentId — fil de messages d'un dossier
router.get('/:shipmentId', authenticateAny, async (req, res) => {
  try {
    await ensureMessagesTable();
    const shipment = await loadAuthorizedShipment(req, res);
    if (!shipment) return;

    // Ouvrir le fil marque comme lus les messages envoyés par l'autre partie
    // (le client lit les réponses du staff, le staff lit les messages du client).
    const opposingRoles = req.user.role === 'client' ? ['ADMIN', 'GESTIONNAIRE'] : ['CLIENT'];
    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE shipment_id = $1 AND sender_role = ANY($2) AND is_read = FALSE',
      [shipment.id, opposingRoles]
    );

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
      // Reçu par l'admin ET le gestionnaire — n'importe lequel des deux peut répondre.
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
