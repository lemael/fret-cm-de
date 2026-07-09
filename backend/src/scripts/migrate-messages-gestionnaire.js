require('dotenv').config();
const pool = require('../config/db');

async function run() {
  try {
    await pool.query('ALTER TABLE messages ALTER COLUMN sender_role TYPE VARCHAR(15)');

    const constraintResult = await pool.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'messages' AND con.contype = 'c'
    `);

    for (const row of constraintResult.rows) {
      await pool.query(`ALTER TABLE messages DROP CONSTRAINT "${row.conname}"`);
    }

    await pool.query(`
      ALTER TABLE messages ADD CONSTRAINT messages_sender_role_check
        CHECK (sender_role IN ('CLIENT','ADMIN','GESTIONNAIRE'))
    `);

    console.log('Migration terminee: messages.sender_role accepte desormais GESTIONNAIRE.');
  } catch (error) {
    console.error('Echec migration messages-gestionnaire:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
