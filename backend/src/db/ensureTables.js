const pool = require('../config/db');

// Garde-fous de création de table à l'exécution, au cas où une migration
// n'aurait pas encore tourné sur l'environnement cible (même pattern que
// ensureWorkflowTable dans routes/clients.js). Partagé par plusieurs routers
// qui lisent/écrivent tous dans la table `notifications`.

let notificationsTableEnsured = false;
const ensureNotificationsTable = async () => {
  if (notificationsTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type                VARCHAR(30) NOT NULL,
      title               VARCHAR(150) NOT NULL,
      body                TEXT,
      related_shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
      is_read             BOOLEAN NOT NULL DEFAULT FALSE,
      created_at          TIMESTAMP DEFAULT NOW()
    )
  `);
  notificationsTableEnsured = true;
};

const createNotification = async ({ type, title, body, relatedShipmentId }) => {
  await ensureNotificationsTable();
  await pool.query(
    `INSERT INTO notifications (type, title, body, related_shipment_id)
     VALUES ($1, $2, $3, $4)`,
    [type, title, body || null, relatedShipmentId || null]
  );
};

module.exports = { ensureNotificationsTable, createNotification };
