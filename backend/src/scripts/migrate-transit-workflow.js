require('dotenv').config();
const pool = require('../config/db');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transit_workflows (
        admin_id UUID PRIMARY KEY REFERENCES admins(id) ON DELETE CASCADE,
        is_transit_started BOOLEAN NOT NULL DEFAULT FALSE,
        active_phase VARCHAR(20) NOT NULL DEFAULT 'LOADING'
          CHECK (active_phase IN ('LOADING','AT_SEA','DISTRIBUTION')),
        departure_date DATE,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Migration terminee: transit_workflows creee.');
  } catch (error) {
    console.error('Echec migration transit_workflows:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
