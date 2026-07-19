const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { authenticateAny, requireRole } = require('../middleware/auth');
const { parseMessage, extractShipmentDetails } = require('../services/parser');
const { computePriceEur, getPricingConfig, ensureSizeCategoryColumn } = require('../services/pricing');
const { createAnnouncement } = require('./announcements');

const router = express.Router();

const ALLOWED_PHASES = new Set(['LOADING', 'AT_SEA', 'DISTRIBUTION']);

const STAFF_ROLES = new Set(['admin', 'gestionnaire']);

// Distribution des colis au Cameroun (point de vue gestionnaire) — le gestionnaire
// ne peut faire progresser un colis qu'à travers ces statuts.
const DISTRIBUTION_STATUSES = new Set(['COLIS_PRET_ENVOI_CM', 'COLIS_EXISTANT', 'COLIS_BIEN_ENVOYE', 'COLIS_INTROUVABLE']);

const inferPhaseFromStatus = (status) => {
  if (['DISTRIBUE', 'LIVRE', 'EN_DISTRIBUTION', 'EN_ATTENTE_DISTRIBUTION'].includes(status)) {
    return 'DISTRIBUTION';
  }
  if (['EN_MER', 'EN_TRANSIT_MARITIME', 'TRACKING_EN_COURS'].includes(status)) {
    return 'AT_SEA';
  }
  return 'LOADING';
};

let verifiedProductsColumnEnsured = false;
const ensureVerifiedProductsColumn = async () => {
  if (verifiedProductsColumnEnsured) return;
  await pool.query('ALTER TABLE shipments ADD COLUMN IF NOT EXISTS verified_products JSONB');
  verifiedProductsColumnEnsured = true;
};

let shipmentsColumnsCache = null;

const getShipmentsColumns = async () => {
  if (shipmentsColumnsCache) {
    return shipmentsColumnsCache;
  }

  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'shipments'`
  );

  shipmentsColumnsCache = new Set(result.rows.map((row) => row.column_name));
  return shipmentsColumnsCache;
};

// POST /api/shipments/parse — analyse un message WhatsApp et crée un dossier
router.post('/parse', auth, async (req, res) => {
  const { phone, name, rawMessage, subject } = req.body;
  if (!phone || !rawMessage) {
    return res.status(400).json({ error: 'Numéro de téléphone et message requis' });
  }

  try {
    const shipmentsColumns = await getShipmentsColumns();
    const hasPhase = shipmentsColumns.has('phase');
    const hasDepartureDate = shipmentsColumns.has('departure_date');

    // Upsert client par téléphone
    const clientResult = await pool.query(
      `INSERT INTO clients (phone, name) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, clients.name)
       RETURNING *`,
      [phone, name || null]
    );
    const client = clientResult.rows[0];

    const normalizedSubject = subject === 'SEND_PACKAGE' ? 'SEND_PACKAGE' : 'OTHER';
    const category = normalizedSubject === 'SEND_PACKAGE' ? 'SHIPMENT' : parseMessage(rawMessage);

    let parcelDetails = null;
    let requestedStatus = 'EN_ATTENTE_CHARGEMENT';
    if (normalizedSubject === 'SEND_PACKAGE') {
      parcelDetails = extractShipmentDetails(rawMessage, {
        clientName: client.name,
        clientPhone: client.phone,
      });
      requestedStatus = parcelDetails.isComplete ? 'PRET_A_PARTIR' : 'EN_ATTENTE_CHARGEMENT';
    }

    const trackingToken = uuidv4();

    const insertColumns = ['client_id'];
    const values = [client.id];

    if (hasPhase) {
      insertColumns.push('phase');
      values.push('LOADING');
    }

    insertColumns.push('category');
    values.push(category);

    insertColumns.push('status');
    values.push(requestedStatus);

    if (hasDepartureDate) {
      insertColumns.push('departure_date');
      values.push(null);
    }

    insertColumns.push('tracking_token');
    values.push(trackingToken);

    insertColumns.push('raw_message');
    values.push(rawMessage);

    const placeholders = values.map((_, index) => `$${index + 1}`);

    const statusValueIndex = insertColumns.indexOf('status');
    const statusCandidates =
      normalizedSubject === 'SEND_PACKAGE' && parcelDetails?.isComplete
        ? ['PRET_A_PARTIR', 'READY_TO_LOAD', 'EN_ATTENTE_CHARGEMENT']
        : [requestedStatus];

    let shipmentResult = null;
    let finalStatus = requestedStatus;

    for (const candidateStatus of statusCandidates) {
      const candidateValues = [...values];
      candidateValues[statusValueIndex] = candidateStatus;

      try {
        shipmentResult = await pool.query(
          `INSERT INTO shipments (${insertColumns.join(', ')})
           VALUES (${placeholders.join(', ')}) RETURNING *`,
          candidateValues
        );
        finalStatus = candidateStatus;
        break;
      } catch (insertErr) {
        if (candidateStatus === statusCandidates[statusCandidates.length - 1]) {
          throw insertErr;
        }
      }
    }

    const baseUrl = process.env.WEB_URL || 'https://ravishing-endurance-production-7ff1.up.railway.app';
    res.status(201).json({
      client,
      shipment: shipmentResult.rows[0],
      parcel: parcelDetails?.parcel || null,
      parcelMissingFields: parcelDetails?.missingFields || [],
      parcelReadyToDepart: ['PRET_A_PARTIR', 'READY_TO_LOAD'].includes(finalStatus),
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
    const shipmentsColumns = await getShipmentsColumns();
    const hasPhase = shipmentsColumns.has('phase');
    const hasDepartureDate = shipmentsColumns.has('departure_date');

    const setClauses = ['status = $1'];
    const values = [status];
    let valueIndex = 2;

    if (hasPhase) {
      setClauses.push(`phase = $${valueIndex}`);
      values.push(nextPhase);
      valueIndex += 1;
    }

    if (hasDepartureDate) {
      setClauses.push(`departure_date = COALESCE($${valueIndex}, departure_date)`);
      values.push(departureDate || null);
      valueIndex += 1;
    }

    setClauses.push('updated_at = NOW()');
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE shipments
       SET ${setClauses.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Dossier introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/shipments/client-orders — réception des commandes soumises par les clients (admin)
router.get('/client-orders', auth, async (_req, res) => {
  try {
    await ensureSizeCategoryColumn();
    const [result, pricingConfig] = await Promise.all([
      pool.query(
        `SELECT s.id, s.status, s.tracking_token, s.content_description, s.created_at,
                s.weight_kg, s.length_cm, s.width_cm, s.height_cm, s.size_category,
                s.pickup_address, s.delivery_address,
                c.name AS client_name, c.phone AS client_phone
         FROM shipments s
         JOIN clients c ON c.id = s.client_id
         WHERE s.source = 'CLIENT_APP' AND s.batch_id IS NULL
         ORDER BY s.created_at DESC`
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

// GET /api/shipments/distribution — chargement/distribution des colis transférés par
// l'admin (au Cameroun) — admin lecture, gestionnaire édition. Un colis apparaît ici
// dès qu'il a été transféré (batch_id renseigné) et tant qu'il n'a pas été clôturé
// (COLIS_BIEN_ENVOYE) — au-delà, il bascule dans l'historique d'envoi.
// Sert aussi de source à "Confirmation de colis" (même lot, mêmes lignes).
router.get('/distribution', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    await Promise.all([ensureSizeCategoryColumn(), ensureVerifiedProductsColumn()]);
    const [result, pricingConfig] = await Promise.all([
      pool.query(
        `SELECT s.id, s.status, s.tracking_token, s.content_description, s.updated_at,
                s.weight_kg, s.length_cm, s.width_cm, s.height_cm, s.size_category,
                s.pickup_address, s.delivery_address, s.verified_products,
                c.name AS client_name, c.phone AS client_phone
         FROM shipments s
         JOIN clients c ON c.id = s.client_id
         WHERE s.batch_id IS NOT NULL AND s.status != 'COLIS_BIEN_ENVOYE'
         ORDER BY s.updated_at DESC`
      ),
      getPricingConfig(),
    ]);
    const parcels = result.rows.map((row) => ({
      ...row,
      price_eur: computePriceEur(row, pricingConfig),
    }));
    res.json(parcels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/shipments/close-loading — "Clôture de chargement" (gestionnaire) : clôture
// tous les colis du lot entièrement cochés dans "Confirmation de colis" (COLIS_BIEN_ENVOYE),
// et publie une annonce pour les clients.
router.post('/close-loading', requireRole('gestionnaire'), async (_req, res) => {
  try {
    await ensureVerifiedProductsColumn();
    const result = await pool.query(
      `SELECT id, content_description, verified_products
       FROM shipments
       WHERE batch_id IS NOT NULL AND status != 'COLIS_BIEN_ENVOYE'`
    );

    const fullyCheckedIds = result.rows
      .filter((row) => {
        const products = (row.content_description || '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        return (
          products.length > 0 &&
          Array.isArray(row.verified_products) &&
          row.verified_products.length === products.length &&
          row.verified_products.every((checked) => checked === true)
        );
      })
      .map((row) => row.id);

    if (fullyCheckedIds.length === 0) {
      return res.status(400).json({ error: 'Aucun colis entièrement confirmé' });
    }

    await pool.query(
      `UPDATE shipments SET status = 'COLIS_BIEN_ENVOYE', updated_at = NOW() WHERE id = ANY($1)`,
      [fullyCheckedIds]
    );

    await createAnnouncement({
      title: 'Chargement des colis',
      body: 'Les colis sont chargés et prêts à l\'envoi.',
      authorRole: 'GESTIONNAIRE',
    });

    res.status(201).json({ closedCount: fullyCheckedIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/shipments/shipped-history — historique des colis clôturés (envoyés)
router.get('/shipped-history', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    await Promise.all([ensureSizeCategoryColumn(), ensureVerifiedProductsColumn()]);
    const [result, pricingConfig] = await Promise.all([
      pool.query(
        `SELECT s.id, s.status, s.tracking_token, s.content_description, s.updated_at,
                s.weight_kg, s.length_cm, s.width_cm, s.height_cm, s.size_category,
                s.pickup_address, s.delivery_address, s.verified_products,
                c.name AS client_name, c.phone AS client_phone
         FROM shipments s
         JOIN clients c ON c.id = s.client_id
         WHERE s.status = 'COLIS_BIEN_ENVOYE'
         ORDER BY s.updated_at DESC`
      ),
      getPricingConfig(),
    ]);
    const parcels = result.rows.map((row) => ({
      ...row,
      price_eur: computePriceEur(row, pricingConfig),
    }));
    res.json(parcels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/shipments/:id/verified-products — le gestionnaire coche les produits
// physiquement remis, pour les comparer à la commande déclarée par le client
// ("Confirmation de colis").
router.patch('/:id/verified-products', requireRole('gestionnaire'), async (req, res) => {
  const { verifiedProducts } = req.body;
  if (!Array.isArray(verifiedProducts) || !verifiedProducts.every((v) => typeof v === 'boolean')) {
    return res.status(400).json({ error: 'Liste de cases à cocher invalide' });
  }

  try {
    await ensureVerifiedProductsColumn();
    const result = await pool.query(
      `UPDATE shipments SET verified_products = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(verifiedProducts), req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Dossier introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/shipments/:id/report-issue — le gestionnaire signale un problème sur une
// commande depuis "Confirmation de colis". Le message est publié comme annonce
// ciblée, visible par l'admin (qui voit toutes les annonces) et uniquement le
// client concerné — pas les autres clients.
router.post('/:id/report-issue', requireRole('gestionnaire'), async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message requis' });
  }

  try {
    const result = await pool.query(
      'SELECT tracking_token, client_id FROM shipments WHERE id = $1',
      [req.params.id]
    );
    const shipment = result.rows[0];
    if (!shipment) return res.status(404).json({ error: 'Dossier introuvable' });

    const orderNumber = shipment.tracking_token.slice(0, 8);
    const sentAt = new Date().toLocaleString('fr-FR');

    const announcement = await createAnnouncement({
      title: `Problème sur la commande #${orderNumber}`,
      body: `Commande #${orderNumber} — envoyé le ${sentAt}\n\n${message.trim()}`,
      authorRole: 'GESTIONNAIRE',
      clientId: shipment.client_id,
      shipmentId: req.params.id,
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/shipments/:id/distribution-status — le gestionnaire fait progresser un colis
router.patch('/:id/distribution-status', requireRole('gestionnaire'), async (req, res) => {
  const { status } = req.body;
  if (!DISTRIBUTION_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  try {
    const result = await pool.query(
      `UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    const shipment = result.rows[0];
    if (!shipment) return res.status(404).json({ error: 'Dossier introuvable' });

    // Le premier colis d'un envoi qui arrive au Cameroun marque tout l'envoi comme reçu.
    if (status === 'COLIS_EXISTANT' && shipment.batch_id) {
      await pool.query(
        'UPDATE shipment_batches SET received_at = NOW() WHERE id = $1 AND received_at IS NULL',
        [shipment.batch_id]
      );
    }

    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/shipments/close-batch — transfère au gestionnaire toutes les commandes
// clients pas encore transférées (bouton "Transférer au gestionnaire", admin).
router.post('/close-batch', auth, async (_req, res) => {
  try {
    const readyResult = await pool.query(
      `SELECT id FROM shipments WHERE source = 'CLIENT_APP' AND batch_id IS NULL`
    );
    if (readyResult.rows.length === 0) {
      return res.status(400).json({ error: 'Aucune commande à transférer' });
    }

    const batchResult = await pool.query(
      'INSERT INTO shipment_batches DEFAULT VALUES RETURNING *'
    );
    const batch = batchResult.rows[0];

    await pool.query(
      `UPDATE shipments SET batch_id = $1 WHERE source = 'CLIENT_APP' AND batch_id IS NULL`,
      [batch.id]
    );

    res.status(201).json({ batch, packagesCount: readyResult.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/shipments/current-batch — résumé de l'envoi en cours (tableau de bord
// gestionnaire) : date de transfert par l'admin, nombre de commandes attendues
// (transférées et pas encore envoyées) et nombre de colis confirmés dans
// "Confirmation de colis" (tous les produits déclarés cochés).
router.get('/current-batch', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    await ensureVerifiedProductsColumn();
    const result = await pool.query(
      `SELECT s.content_description, s.verified_products, b.id AS batch_id, b.shipped_at
       FROM shipment_batches b
       JOIN shipments s ON s.batch_id = b.id AND s.status != 'COLIS_BIEN_ENVOYE'
       ORDER BY b.shipped_at DESC`
    );

    if (result.rows.length === 0) {
      return res.json({ shippedAt: null, expectedCount: 0, confirmedCount: 0, loadingPercent: 0 });
    }

    const currentBatchId = result.rows[0].batch_id;
    const currentRows = result.rows.filter((row) => row.batch_id === currentBatchId);

    const confirmedCount = currentRows.filter((row) => {
      const products = (row.content_description || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return (
        products.length > 0 &&
        Array.isArray(row.verified_products) &&
        row.verified_products.length === products.length &&
        row.verified_products.every((checked) => checked === true)
      );
    }).length;

    const expectedCount = currentRows.length;

    res.json({
      shippedAt: currentRows[0].shipped_at,
      expectedCount,
      confirmedCount,
      loadingPercent: expectedCount > 0 ? Math.round((confirmedCount / expectedCount) * 100) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/shipments/batches — historique des envois groupés (admin)
router.get('/batches', auth, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.shipped_at, b.received_at, COUNT(s.id) AS packages_count
       FROM shipment_batches b
       LEFT JOIN shipments s ON s.batch_id = b.id
       GROUP BY b.id
       ORDER BY b.shipped_at DESC
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
