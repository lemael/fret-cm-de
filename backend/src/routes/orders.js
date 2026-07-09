const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { createNotification } = require('../db/ensureTables');

const router = express.Router();
const auth = requireRole('client');

let shipmentsColumnsCache = null;
const getShipmentsColumns = async () => {
  if (shipmentsColumnsCache) return shipmentsColumnsCache;
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'shipments'`
  );
  shipmentsColumnsCache = new Set(result.rows.map((row) => row.column_name));
  return shipmentsColumnsCache;
};

const REQUIRED_FIELDS = ['weightKg', 'contentDescription', 'pickupAddress', 'deliveryAddress'];

// POST /api/orders — le client crée une commande (statut en attente de validation admin)
router.post('/', auth, async (req, res) => {
  const {
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    contentDescription,
    pickupAddress,
    deliveryAddress,
  } = req.body;

  const missing = REQUIRED_FIELDS.filter((field) => !req.body[field]);
  if (missing.length) {
    return res.status(400).json({ error: `Champs manquants: ${missing.join(', ')}` });
  }

  if (Number.isNaN(Number(weightKg)) || Number(weightKg) <= 0) {
    return res.status(400).json({ error: 'Poids invalide' });
  }

  try {
    const columns = await getShipmentsColumns();

    const insertColumns = ['client_id', 'category', 'status', 'tracking_token'];
    const values = [req.client.id, 'SHIPMENT', 'COLIS_NON_RECU', uuidv4()];

    const optionalColumns = {
      phase: 'LOADING',
      weight_kg: weightKg,
      length_cm: lengthCm || null,
      width_cm: widthCm || null,
      height_cm: heightCm || null,
      content_description: contentDescription,
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      source: 'CLIENT_APP',
    };

    for (const [column, value] of Object.entries(optionalColumns)) {
      if (columns.has(column)) {
        insertColumns.push(column);
        values.push(value);
      }
    }

    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await pool.query(
      `INSERT INTO shipments (${insertColumns.join(', ')})
       VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    const shipment = result.rows[0];

    const clientResult = await pool.query('SELECT name, phone FROM clients WHERE id = $1', [req.client.id]);
    const client = clientResult.rows[0];

    await createNotification({
      type: 'NEW_ORDER',
      title: 'Nouvelle commande client',
      body: `${client?.name || client?.phone || 'Un client'} a soumis une nouvelle commande.`,
      relatedShipmentId: shipment.id,
    });

    const baseUrl = process.env.WEB_URL || 'https://ravishing-endurance-production-7ff1.up.railway.app';
    res.status(201).json({
      shipment,
      statusLink: `${baseUrl}/status/${shipment.tracking_token}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/orders/mine — dossiers du client connecté
router.get('/mine', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shipments WHERE client_id = $1 ORDER BY created_at DESC',
      [req.client.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
