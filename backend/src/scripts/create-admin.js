/**
 * Script utilitaire pour créer le premier compte admin.
 * Usage : node src/scripts/create-admin.js
 *
 * Il affiche le hash bcrypt à insérer dans la table admins.
 * Exemple d'insertion :
 *   INSERT INTO admins (username, password_hash) VALUES ('admin', '<hash>');
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

(async () => {
  const username = await ask('Nom d\'utilisateur admin : ');
  const password = await ask('Mot de passe : ');
  rl.close();

  const hash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      'INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    );
    console.log('\nAdmin créé avec succès :', result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      console.error('Erreur : ce nom d\'utilisateur existe déjà.');
    } else {
      console.error('Erreur :', err.message);
    }
  } finally {
    await pool.end();
  }
})();
