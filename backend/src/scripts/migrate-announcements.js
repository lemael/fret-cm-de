require('dotenv').config();
const pool = require('../config/db');

async function run() {
  try {
    await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_announcement_seen_at TIMESTAMP');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title       VARCHAR(150) NOT NULL,
        body        TEXT NOT NULL,
        author_role VARCHAR(15) NOT NULL CHECK (author_role IN ('ADMIN','GESTIONNAIRE')),
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Migration terminee: annonces et suivi client crees.');
  } catch (error) {
    console.error('Echec migration announcements:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
