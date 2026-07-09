require('dotenv').config();
const pool = require('../config/db');

async function run() {
  try {
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gestionnaires (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username      VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name          VARCHAR(100),
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS length_cm NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS width_cm NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS height_cm NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS content_description TEXT`);
    await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_address TEXT`);
    await pool.query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_address TEXT`);
    await pool.query(`
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'ADMIN_PARSED'
    `);
    await pool.query(`
      ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_source_check
    `);
    await pool.query(`
      ALTER TABLE shipments ADD CONSTRAINT shipments_source_check
        CHECK (source IN ('ADMIN_PARSED','CLIENT_APP'))
    `);

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
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_shipment ON messages(shipment_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
        type        VARCHAR(20) NOT NULL DEFAULT 'AUTRE' CHECK (type IN ('LOST','NON_CONFORME','AUTRE')),
        description TEXT,
        status      VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED')),
        resolution  TEXT,
        resolved_by UUID REFERENCES gestionnaires(id) ON DELETE SET NULL,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_disputes_shipment ON disputes(shipment_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shipment_id       UUID REFERENCES shipments(id) ON DELETE SET NULL,
        gestionnaire_id   UUID REFERENCES gestionnaires(id) ON DELETE SET NULL,
        amount            NUMERIC(12,2) NOT NULL,
        commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        type              VARCHAR(20) NOT NULL CHECK (type IN ('COLLECTE','COMMISSION','REVERSEMENT')),
        status            VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (status IN ('EN_ATTENTE','VALIDE','ANNULE')),
        notes             TEXT,
        created_at        TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_gestionnaire ON transactions(gestionnaire_id)`);

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
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);

    console.log('Migration terminee: portail client/gestionnaire cree.');
  } catch (error) {
    console.error('Echec migration client-portal:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
