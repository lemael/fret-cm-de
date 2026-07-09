require('dotenv').config();
const pool = require('../config/db');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shipment_batches (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shipped_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        received_at TIMESTAMP,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(
      'ALTER TABLE shipments ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES shipment_batches(id) ON DELETE SET NULL'
    );
    await pool.query('CREATE INDEX IF NOT EXISTS idx_shipments_batch ON shipments(batch_id)');

    console.log('Migration terminee: shipment_batches cree.');
  } catch (error) {
    console.error('Echec migration shipment-batches:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
