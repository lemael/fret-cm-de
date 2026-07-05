-- Schéma PostgreSQL — Fret CM-DE
-- À exécuter une seule fois sur la base Railway

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- Administrateurs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- Clients (identifiant unique = téléphone)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      VARCHAR(20) UNIQUE NOT NULL,
  name       VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- Dossiers / expéditions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phase          VARCHAR(20) NOT NULL DEFAULT 'LOADING'
                   CHECK (phase IN ('LOADING','AT_SEA','DISTRIBUTION')),
  category       VARCHAR(20) NOT NULL
                   CHECK (category IN ('ARRIVAL','CLAIM','SHIPMENT','SCHEDULE','CUSTOMS','UNKNOWN')),
  status         VARCHAR(50) NOT NULL DEFAULT 'EN_ATTENTE_CHARGEMENT',
  departure_date DATE,
  tracking_token VARCHAR(36) UNIQUE NOT NULL,
  raw_message    TEXT,
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_token  ON shipments(tracking_token);
CREATE INDEX IF NOT EXISTS idx_shipments_client ON shipments(client_id);
CREATE INDEX IF NOT EXISTS idx_shipments_phase  ON shipments(phase);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_departure_date ON shipments(departure_date);

-- ─────────────────────────────────────────
-- Workflow transit admin (etat UI persiste)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transit_workflows (
  admin_id            UUID PRIMARY KEY REFERENCES admins(id) ON DELETE CASCADE,
  is_transit_started  BOOLEAN NOT NULL DEFAULT FALSE,
  active_phase        VARCHAR(20) NOT NULL DEFAULT 'LOADING'
                        CHECK (active_phase IN ('LOADING','AT_SEA','DISTRIBUTION')),
  departure_date      DATE,
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- Créer le premier admin
-- Générer le hash avec : node backend/src/scripts/create-admin.js
-- puis coller le résultat ici
-- ─────────────────────────────────────────
-- INSERT INTO admins (username, password_hash) VALUES ('admin', '$2a$10$...');
