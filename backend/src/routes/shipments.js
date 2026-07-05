const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { parseMessage, extractShipmentDetails } = require('../services/parser');

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

module.exports = router;
