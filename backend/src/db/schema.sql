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
-- password_hash est NULL tant que le client n'a pas créé son compte
-- (fiche créée par l'admin via le parsing de messages) ; il se remplit
-- lors de l'auto-inscription cliente.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                     VARCHAR(20) UNIQUE NOT NULL,
  name                      VARCHAR(100),
  password_hash             VARCHAR(255),
  last_announcement_seen_at TIMESTAMP,
  created_at                TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- Gestionnaires de colis (Cameroun) — identifiants fixes provisionnés
-- Générer le hash avec : node backend/src/scripts/create-gestionnaire.js
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gestionnaires (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100),
  created_at    TIMESTAMP DEFAULT NOW()
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
  -- Champs de commande structurée (saisis par le client depuis l'app)
  weight_kg           NUMERIC(10,2),
  length_cm           NUMERIC(10,2),
  width_cm            NUMERIC(10,2),
  height_cm           NUMERIC(10,2),
  content_description TEXT,
  pickup_address       TEXT,
  delivery_address     TEXT,
  source               VARCHAR(20) NOT NULL DEFAULT 'ADMIN_PARSED'
                          CHECK (source IN ('ADMIN_PARSED','CLIENT_APP')),
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
-- Messagerie interne (client <-> admin), liée à un dossier
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sender_role VARCHAR(15) NOT NULL CHECK (sender_role IN ('CLIENT','ADMIN','GESTIONNAIRE')),
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_shipment ON messages(shipment_id);
CREATE INDEX IF NOT EXISTS idx_messages_client   ON messages(client_id);

-- ─────────────────────────────────────────
-- Litiges (colis perdu / non conforme) — gérés par le gestionnaire
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL DEFAULT 'AUTRE'
                CHECK (type IN ('LOST','NON_CONFORME','AUTRE')),
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED')),
  resolution  TEXT,
  resolved_by UUID REFERENCES gestionnaires(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_shipment ON disputes(shipment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status   ON disputes(status);

-- ─────────────────────────────────────────
-- Flux financiers et commissions (grand livre du gestionnaire)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id        UUID REFERENCES shipments(id) ON DELETE SET NULL,
  gestionnaire_id    UUID REFERENCES gestionnaires(id) ON DELETE SET NULL,
  amount             NUMERIC(12,2) NOT NULL,
  commission_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  type               VARCHAR(20) NOT NULL
                        CHECK (type IN ('COLLECTE','COMMISSION','REVERSEMENT')),
  status             VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
                        CHECK (status IN ('EN_ATTENTE','VALIDE','ANNULE')),
  notes              TEXT,
  created_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_gestionnaire ON transactions(gestionnaire_id);

-- ─────────────────────────────────────────
-- Notifications admin (nouvelle commande, nouveau message client, ...)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 VARCHAR(30) NOT NULL,
  title                VARCHAR(150) NOT NULL,
  body                 TEXT,
  related_shipment_id  UUID REFERENCES shipments(id) ON DELETE SET NULL,
  is_read              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ─────────────────────────────────────────
-- Annonces diffusées par l'admin ou le gestionnaire à tous les clients
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(150) NOT NULL,
  body        TEXT NOT NULL,
  author_role VARCHAR(15) NOT NULL CHECK (author_role IN ('ADMIN','GESTIONNAIRE')),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- Créer le premier admin
-- Générer le hash avec : node backend/src/scripts/create-admin.js
-- puis coller le résultat ici
-- ─────────────────────────────────────────
-- INSERT INTO admins (username, password_hash) VALUES ('admin', '$2a$10$...');
