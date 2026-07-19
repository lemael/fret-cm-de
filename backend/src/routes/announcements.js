const express = require('express');
const pool = require('../config/db');
const { authenticateAny } = require('../middleware/auth');
const { computePriceEur, getPricingConfig, ensureSizeCategoryColumn } = require('../services/pricing');

const router = express.Router();

const STAFF_ROLES = new Set(['admin', 'gestionnaire']);

let announcementsTableEnsured = false;
const ensureAnnouncementsTable = async () => {
  if (announcementsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(150) NOT NULL,
      body        TEXT NOT NULL,
      author_role VARCHAR(15) NOT NULL CHECK (author_role IN ('ADMIN','GESTIONNAIRE')),
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  announcementsTableEnsured = true;
};

// client_id NULL = annonce diffusée à tous les clients ; renseigné = message ciblé,
// visible uniquement par ce client (et le staff, qui voit tout) — ex: signalement
// de problème depuis "Confirmation de colis".
let announcementsClientColumnEnsured = false;
const ensureAnnouncementsClientColumn = async () => {
  if (announcementsClientColumnEnsured) return;
  await pool.query(
    'ALTER TABLE announcements ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE'
  );
  announcementsClientColumnEnsured = true;
};

// shipment_id : renseigné quand l'annonce est un signalement de problème lié à
// une commande précise ("Confirmation de colis") — permet d'afficher le détail
// de la commande dans la vue détaillée de l'annonce.
let announcementsShipmentColumnEnsured = false;
const ensureAnnouncementsShipmentColumn = async () => {
  if (announcementsShipmentColumnEnsured) return;
  await pool.query(
    'ALTER TABLE announcements ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL'
  );
  announcementsShipmentColumnEnsured = true;
};

let commentsTableEnsured = false;
const ensureAnnouncementCommentsTable = async () => {
  if (commentsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement_comments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      author_role     VARCHAR(15) NOT NULL CHECK (author_role IN ('ADMIN','GESTIONNAIRE','CLIENT')),
      author_id       UUID NOT NULL,
      body            TEXT NOT NULL,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  commentsTableEnsured = true;
};

// Un client ne peut voir/commenter que les annonces diffusées à tous ou celles
// qui lui sont spécifiquement adressées (même règle que la liste).
const canAccessAnnouncement = (req, announcement) =>
  req.user.role !== 'client' || !announcement.client_id || announcement.client_id === req.user.id;

// Réutilisable par d'autres routes (ex: clôture de chargement, signalement de
// problème) pour publier une annonce automatique sans passer par une requête HTTP.
const createAnnouncement = async ({ title, body, authorRole, clientId = null, shipmentId = null }) => {
  await ensureAnnouncementsTable();
  await ensureAnnouncementsClientColumn();
  await ensureAnnouncementsShipmentColumn();
  const result = await pool.query(
    `INSERT INTO announcements (title, body, author_role, client_id, shipment_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, body, authorRole, clientId, shipmentId]
  );
  return result.rows[0];
};

// GET /api/announcements — visible par les 3 profils ; un client ne voit que les
// annonces diffusées à tous + celles qui lui sont spécifiquement adressées.
router.get('/', authenticateAny, async (req, res) => {
  try {
    await ensureAnnouncementsTable();
    await ensureAnnouncementsClientColumn();

    const result =
      req.user.role === 'client'
        ? await pool.query(
            'SELECT * FROM announcements WHERE client_id IS NULL OR client_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
          )
        : await pool.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50');

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/announcements — admin ou gestionnaire
router.post('/', authenticateAny, async (req, res) => {
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { title, body } = req.body;
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: 'Titre et texte requis' });
  }

  try {
    await ensureAnnouncementsTable();
    const result = await pool.query(
      `INSERT INTO announcements (title, body, author_role) VALUES ($1, $2, $3) RETURNING *`,
      [title.trim(), body.trim(), req.user.role.toUpperCase()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/announcements/:id — détail d'une annonce : commande associée (le cas
// échéant, ex: signalement de problème) et fil de commentaires.
router.get('/:id', authenticateAny, async (req, res) => {
  try {
    await Promise.all([
      ensureAnnouncementsTable(),
      ensureAnnouncementsClientColumn(),
      ensureAnnouncementsShipmentColumn(),
      ensureAnnouncementCommentsTable(),
    ]);

    const announcementResult = await pool.query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
    const announcement = announcementResult.rows[0];
    if (!announcement) return res.status(404).json({ error: 'Annonce introuvable' });

    if (!canAccessAnnouncement(req, announcement)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    let shipment = null;
    if (announcement.shipment_id) {
      await ensureSizeCategoryColumn();
      const [shipmentResult, pricingConfig] = await Promise.all([
        pool.query(
          `SELECT s.id, s.status, s.tracking_token, s.content_description, s.created_at, s.updated_at,
                  s.weight_kg, s.length_cm, s.width_cm, s.height_cm, s.size_category,
                  s.pickup_address, s.delivery_address,
                  c.name AS client_name, c.phone AS client_phone
           FROM shipments s
           JOIN clients c ON c.id = s.client_id
           WHERE s.id = $1`,
          [announcement.shipment_id]
        ),
        getPricingConfig(),
      ]);
      const row = shipmentResult.rows[0];
      if (row) {
        shipment = { ...row, price_eur: computePriceEur(row, pricingConfig) };
      }
    }

    const commentsResult = await pool.query(
      'SELECT * FROM announcement_comments WHERE announcement_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ announcement, shipment, comments: commentsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/announcements/:id/comments — commenter une annonce (admin, gestionnaire
// ou le client concerné).
router.post('/:id/comments', authenticateAny, async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Commentaire vide' });
  }

  try {
    await Promise.all([ensureAnnouncementsClientColumn(), ensureAnnouncementCommentsTable()]);

    const announcementResult = await pool.query(
      'SELECT client_id FROM announcements WHERE id = $1',
      [req.params.id]
    );
    const announcement = announcementResult.rows[0];
    if (!announcement) return res.status(404).json({ error: 'Annonce introuvable' });

    if (!canAccessAnnouncement(req, announcement)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = await pool.query(
      `INSERT INTO announcement_comments (announcement_id, author_role, author_id, body)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user.role.toUpperCase(), req.user.id, body.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
module.exports.createAnnouncement = createAnnouncement;
module.exports.ensureAnnouncementsClientColumn = ensureAnnouncementsClientColumn;
