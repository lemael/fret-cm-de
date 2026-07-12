const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { createNotification } = require('../db/ensureTables');
const { ensureSizeCategoryColumn, computePriceEur, getPricingConfig } = require('../services/pricing');
const { ensureSubscriptionColumns } = require('./clients');

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

// Catégories proposées au client à la place d'une saisie manuelle de dimensions —
// reflètent directement les tranches de la grille de prix (XL/XXL/volumétrique/poids).
const SIZE_CATEGORIES = new Set([
  'XL',
  'XXL',
  'VOLUMETRIC_1M3',
  'BULK_1000_1999',
  'BULK_2000_2999',
  'BULK_3000_PLUS',
]);

const REQUIRED_FIELDS = ['weightKg', 'sizeCategory', 'contentDescription', 'pickupAddress', 'deliveryAddress'];

// POST /api/orders — le client crée une commande (statut en attente de validation admin)
router.post('/', auth, async (req, res) => {
  const {
    weightKg,
    sizeCategory,
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

  if (!SIZE_CATEGORIES.has(sizeCategory)) {
    return res.status(400).json({ error: 'Catégorie de taille invalide' });
  }

  try {
    await Promise.all([ensureSizeCategoryColumn(), ensureSubscriptionColumns()]);

    const clientResult = await pool.query(
      'SELECT name, phone, is_subscribed FROM clients WHERE id = $1',
      [req.client.id]
    );
    const client = clientResult.rows[0];
    if (!client?.is_subscribed) {
      return res.status(403).json({ error: 'Abonnement requis avant de soumettre une commande' });
    }

    const columns = await getShipmentsColumns();

    // COLIS_RECU = affiché "Souhait du client" côté admin (Réception des commandes) —
    // statut initial de toute commande soumise par le client.
    const insertColumns = ['client_id', 'category', 'status', 'tracking_token'];
    const values = [req.client.id, 'SHIPMENT', 'COLIS_RECU', uuidv4()];

    const optionalColumns = {
      phase: 'LOADING',
      weight_kg: weightKg,
      size_category: sizeCategory,
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
    const [result, pricingConfig] = await Promise.all([
      pool.query(
        'SELECT * FROM shipments WHERE client_id = $1 ORDER BY created_at DESC',
        [req.client.id]
      ),
      getPricingConfig(),
    ]);
    const orders = result.rows.map((row) => ({
      ...row,
      price_eur: computePriceEur(row, pricingConfig),
    }));
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
