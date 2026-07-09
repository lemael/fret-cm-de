/**
 * Script utilitaire pour provisionner un compte gestionnaire de colis (Cameroun).
 * Usage : node src/scripts/create-gestionnaire.js
 *
 * Contrairement au client, le gestionnaire n'a pas d'auto-inscription :
 * ses identifiants sont fixes et créés ici par un admin/opérateur.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

(async () => {
  const username = await ask('Nom d\'utilisateur gestionnaire : ');
  const name = await ask('Nom complet (optionnel) : ');
  const password = await ask('Mot de passe : ');
  rl.close();

  const hash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      'INSERT INTO gestionnaires (username, password_hash, name) VALUES ($1, $2, $3) RETURNING id, username',
      [username.trim(), hash, name.trim() || null]
    );
    console.log('\nGestionnaire créé avec succès :', result.rows[0]);
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
