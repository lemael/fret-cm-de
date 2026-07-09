const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { authenticateAny, requireRole } = require('../middleware/auth');
const { parseMessage, extractShipmentDetails } = require('../services/parser');

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
    const result = await pool.query(
      `SELECT s.id, s.status, s.tracking_token, s.content_description, s.created_at,
              c.name AS client_name, c.phone AS client_phone
       FROM shipments s
       JOIN clients c ON c.id = s.client_id
       WHERE s.source = 'CLIENT_APP'
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/shipments/distribution — colis en distribution au Cameroun (admin lecture, gestionnaire édition)
router.get('/distribution', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    const result = await pool.query(
      `SELECT s.id, s.status, s.tracking_token, s.content_description, s.updated_at,
              c.name AS client_name, c.phone AS client_phone
       FROM shipments s
       JOIN clients c ON c.id = s.client_id
       WHERE s.status = ANY($1)
       ORDER BY s.updated_at DESC`,
      [[...DISTRIBUTION_STATUSES]]
    );
    res.json(result.rows);
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

// POST /api/shipments/close-batch — clôture la liste de colis prêts pour le Cameroun (admin)
router.post('/close-batch', auth, async (_req, res) => {
  try {
    const readyResult = await pool.query(
      `SELECT id FROM shipments WHERE status = 'COLIS_PRET_ENVOI_CM' AND batch_id IS NULL`
    );
    if (readyResult.rows.length === 0) {
      return res.status(400).json({ error: "Aucun colis prêt à l'envoi" });
    }

    const batchResult = await pool.query(
      'INSERT INTO shipment_batches DEFAULT VALUES RETURNING *'
    );
    const batch = batchResult.rows[0];

    await pool.query(
      `UPDATE shipments SET batch_id = $1 WHERE status = 'COLIS_PRET_ENVOI_CM' AND batch_id IS NULL`,
      [batch.id]
    );

    res.status(201).json({ batch, packagesCount: readyResult.rows.length });
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
