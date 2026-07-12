const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { authenticateAny, requireRole } = require('../middleware/auth');

const router = express.Router();

const clientAuth = requireRole('client');
const STAFF_ROLES = new Set(['admin', 'gestionnaire']);

let subscriptionColumnsEnsured = false;
const ensureSubscriptionColumns = async () => {
  if (subscriptionColumnsEnsured) return;
  await pool.query(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS street VARCHAR(150),
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMP
  `);
  subscriptionColumnsEnsured = true;
};

const PHASES = {
  LOADING: 'LOADING',
  AT_SEA: 'AT_SEA',
  DISTRIBUTION: 'DISTRIBUTION',
};

const ALLOWED_WORKFLOW_PHASES = new Set(Object.values(PHASES));

let workflowTableEnsured = false;

const ensureWorkflowTable = async () => {
  if (workflowTableEnsured) {
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS transit_workflows (
      admin_id UUID PRIMARY KEY REFERENCES admins(id) ON DELETE CASCADE,
      is_transit_started BOOLEAN NOT NULL DEFAULT FALSE,
      active_phase VARCHAR(20) NOT NULL DEFAULT 'LOADING'
        CHECK (active_phase IN ('LOADING','AT_SEA','DISTRIBUTION')),
      departure_date DATE,
      updated_at TIMESTAMP DEFAULT NOW()
    )`
  );

  workflowTableEnsured = true;
};

const inferPhase = (shipment) => {
  if (shipment.phase && Object.values(PHASES).includes(shipment.phase)) {
    return shipment.phase;
  }

  if (['DISTRIBUE', 'LIVRE', 'EN_DISTRIBUTION', 'EN_ATTENTE_DISTRIBUTION'].includes(shipment.status)) {
    return PHASES.DISTRIBUTION;
  }

  if (['EN_MER', 'EN_TRANSIT_MARITIME', 'TRACKING_EN_COURS'].includes(shipment.status)) {
    return PHASES.AT_SEA;
  }

  return PHASES.LOADING;
};

const emptyOverview = () => ({
  loading: {
    nextDepartureDate: null,
    tabs: {
      readyToDepart: [],
      pendingNotReady: [],
      claims: [],
    },
  },
  atSea: {
    tabs: {
      tracking: [],
      claims: [],
    },
  },
  distribution: {
    tabs: {
      delivered: [],
      pendingNotDelivered: [],
      claims: [],
    },
  },
});

// GET /api/clients/workflow-state — etat workflow de transit pour l'admin connecte
router.get('/workflow-state', auth, async (req, res) => {
  try {
    await ensureWorkflowTable();

    const result = await pool.query(
      `SELECT is_transit_started, active_phase, departure_date
       FROM transit_workflows
       WHERE admin_id = $1`,
      [req.admin.id]
    );

    const row = result.rows[0];
    if (!row) {
      return res.json({
        isTransitStarted: false,
        activePhase: 'loading',
        departureDate: null,
      });
    }

    const phaseMap = {
      LOADING: 'loading',
      AT_SEA: 'atSea',
      DISTRIBUTION: 'distribution',
    };

    res.json({
      isTransitStarted: row.is_transit_started,
      activePhase: phaseMap[row.active_phase] || 'loading',
      departureDate: row.departure_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/clients/workflow-state — persiste l'etat workflow de transit
router.put('/workflow-state', auth, async (req, res) => {
  const { isTransitStarted, activePhase, departureDate } = req.body;

  if (typeof isTransitStarted !== 'boolean') {
    return res.status(400).json({ error: 'isTransitStarted requis (boolean)' });
  }

  const reversePhaseMap = {
    loading: 'LOADING',
    atSea: 'AT_SEA',
    distribution: 'DISTRIBUTION',
  };

  const mappedPhase = reversePhaseMap[activePhase] || 'LOADING';
  if (!ALLOWED_WORKFLOW_PHASES.has(mappedPhase)) {
    return res.status(400).json({ error: 'Phase invalide' });
  }

  if (departureDate && Number.isNaN(Date.parse(departureDate))) {
    return res.status(400).json({ error: 'Date de depart invalide' });
  }

  try {
    await ensureWorkflowTable();

    const result = await pool.query(
      `INSERT INTO transit_workflows (admin_id, is_transit_started, active_phase, departure_date, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (admin_id)
       DO UPDATE SET
         is_transit_started = EXCLUDED.is_transit_started,
         active_phase = EXCLUDED.active_phase,
         departure_date = EXCLUDED.departure_date,
         updated_at = NOW()
       RETURNING is_transit_started, active_phase, departure_date`,
      [req.admin.id, isTransitStarted, mappedPhase, departureDate || null]
    );

    const phaseMap = {
      LOADING: 'loading',
      AT_SEA: 'atSea',
      DISTRIBUTION: 'distribution',
    };

    const row = result.rows[0];
    res.json({
      isTransitStarted: row.is_transit_started,
      activePhase: phaseMap[row.active_phase] || 'loading',
      departureDate: row.departure_date,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients/overview — données agrégées pour le dashboard admin
router.get('/overview', auth, async (_req, res) => {
  try {
    const columnsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'shipments'
         AND column_name IN ('phase', 'departure_date')`
    );

    const availableColumns = new Set(columnsResult.rows.map((row) => row.column_name));
    const phaseSelect = availableColumns.has('phase') ? 's.phase' : 'NULL::varchar AS phase';
    const departureDateSelect = availableColumns.has('departure_date')
      ? 's.departure_date'
      : 'NULL::date AS departure_date';

    const [clientsResult, shipmentsResult] = await Promise.all([
      pool.query('SELECT * FROM clients ORDER BY created_at DESC'),
      pool.query(
        `SELECT s.id, s.client_id, ${phaseSelect}, s.category, s.status, ${departureDateSelect}, s.raw_message, s.created_at,
                c.name, c.phone
         FROM shipments s
         JOIN clients c ON c.id = s.client_id
         ORDER BY s.updated_at DESC`
      ),
    ]);

    const overview = emptyOverview();

    shipmentsResult.rows.forEach((shipment) => {
      const phase = inferPhase(shipment);
      const isClaim = shipment.category === 'CLAIM';
      const status = shipment.status || '';

      if (phase === PHASES.LOADING) {
        if (shipment.departure_date) {
          const current = overview.loading.nextDepartureDate;
          if (!current || new Date(shipment.departure_date) < new Date(current)) {
            overview.loading.nextDepartureDate = shipment.departure_date;
          }
        }

        if (isClaim) {
          overview.loading.tabs.claims.push(shipment);
          return;
        }

        if (['PRET_A_PARTIR', 'READY_TO_LOAD'].includes(status)) {
          overview.loading.tabs.readyToDepart.push(shipment);
          return;
        }

        overview.loading.tabs.pendingNotReady.push(shipment);
        return;
      }

      if (phase === PHASES.AT_SEA) {
        if (isClaim) {
          overview.atSea.tabs.claims.push(shipment);
          return;
        }
        overview.atSea.tabs.tracking.push(shipment);
        return;
      }

      if (isClaim) {
        overview.distribution.tabs.claims.push(shipment);
        return;
      }

      if (['DISTRIBUE', 'LIVRE'].includes(status)) {
        overview.distribution.tabs.delivered.push(shipment);
        return;
      }

      overview.distribution.tabs.pendingNotDelivered.push(shipment);
    });

    res.json({
      clients: clientsResult.rows,
      phases: overview,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients/subscribers — "Clients abonnés" (admin + gestionnaire)
router.get('/subscribers', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  try {
    await ensureSubscriptionColumns();
    const result = await pool.query(
      `SELECT id, name, first_name, phone, street, postal_code, city, is_subscribed
       FROM clients
       ORDER BY name NULLS LAST, first_name NULLS LAST`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/clients/:id/subscription — l'admin bascule manuellement l'abonnement
// d'un client depuis "Clients abonnés".
router.patch('/:id/subscription', requireRole('admin'), async (req, res) => {
  const { isSubscribed } = req.body;
  if (typeof isSubscribed !== 'boolean') {
    return res.status(400).json({ error: 'isSubscribed requis (boolean)' });
  }

  try {
    await ensureSubscriptionColumns();
    const result = await pool.query(
      `UPDATE clients
       SET is_subscribed = $1, subscribed_at = CASE WHEN $1 THEN NOW() ELSE NULL END
       WHERE id = $2
       RETURNING id, name, first_name, phone, street, postal_code, city, is_subscribed`,
      [isSubscribed, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients/subscription-status — statut d'abonnement du client connecté
router.get('/subscription-status', clientAuth, async (req, res) => {
  try {
    await ensureSubscriptionColumns();
    const result = await pool.query(
      `SELECT name, first_name, phone, street, postal_code, city, is_subscribed
       FROM clients WHERE id = $1`,
      [req.client.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/clients/subscribe — le client s'abonne (60€, cf. AGB Phiju Agency)
router.post('/subscribe', clientAuth, async (req, res) => {
  const { nom, prenom, street, postalCode, city, accepted } = req.body;

  if (!nom || !nom.trim() || !prenom || !prenom.trim() || !street || !street.trim() ||
      !postalCode || !postalCode.trim() || !city || !city.trim()) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
  }
  if (accepted !== true) {
    return res.status(400).json({ error: "Vous devez accepter les conditions générales" });
  }

  try {
    await ensureSubscriptionColumns();
    const result = await pool.query(
      `UPDATE clients
       SET name = $1, first_name = $2, street = $3, postal_code = $4, city = $5,
           is_subscribed = TRUE, subscribed_at = NOW()
       WHERE id = $6
       RETURNING name, first_name, phone, street, postal_code, city, is_subscribed`,
      [nom.trim(), prenom.trim(), street.trim(), postalCode.trim(), city.trim(), req.client.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/clients/:id  — détail client + ses dossiers
router.get('/:id', auth, async (req, res) => {
  try {
    const clientResult = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [req.params.id]
    );
    if (!clientResult.rows[0]) {
      return res.status(404).json({ error: 'Client introuvable' });
    }

    const shipmentsResult = await pool.query(
      'SELECT * FROM shipments WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({ client: clientResult.rows[0], shipments: shipmentsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/clients/:id — supprime le compte d'un client (admin) : il perd tout
// accès à l'app. Ses dossiers/messages sont supprimés en cascade (cf. schema.sql).
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Client introuvable' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/clients — création ou mise à jour par téléphone
router.post('/', auth, async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'Numéro de téléphone requis' });

  try {
    const result = await pool.query(
      `INSERT INTO clients (phone, name) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, clients.name)
       RETURNING *`,
      [phone, name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
module.exports.ensureSubscriptionColumns = ensureSubscriptionColumns;
