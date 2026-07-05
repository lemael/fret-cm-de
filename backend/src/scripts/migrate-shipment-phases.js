require('dotenv').config();
const pool = require('../config/db');

async function run() {
  try {
    await pool.query(`
      ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'LOADING'
      CHECK (phase IN ('LOADING','AT_SEA','DISTRIBUTION'))
    `);

    await pool.query(`
      ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS departure_date DATE
    `);

    await pool.query(`
      UPDATE shipments
      SET phase = CASE
        WHEN status IN ('DISTRIBUE', 'LIVRE', 'EN_DISTRIBUTION', 'EN_ATTENTE_DISTRIBUTION') THEN 'DISTRIBUTION'
        WHEN status IN ('EN_MER', 'EN_TRANSIT_MARITIME', 'TRACKING_EN_COURS') THEN 'AT_SEA'
        ELSE 'LOADING'
      END
      WHERE phase IS NULL
    `);

    await pool.query(`
      UPDATE shipments
      SET status = 'EN_ATTENTE_CHARGEMENT'
      WHERE status = 'EN_ATTENTE'
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_shipments_phase ON shipments(phase)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_shipments_departure_date ON shipments(departure_date)');

    console.log('Migration terminee: phases et dates de depart ajoutees.');
  } catch (error) {
    console.error('Echec migration phases:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
