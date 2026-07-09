const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

let clientPasswordColumnEnsured = false;
const ensureClientPasswordColumn = async () => {
  if (clientPasswordColumnEnsured) return;
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
  clientPasswordColumnEnsured = true;
};

let gestionnairesTableEnsured = false;
const ensureGestionnairesTable = async () => {
  if (gestionnairesTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gestionnaires (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username      VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name          VARCHAR(100),
      created_at    TIMESTAMP DEFAULT NOW()
    )
  `);
  gestionnairesTableEnsured = true;
};

const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/login — connexion admin
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );
    const admin = result.rows[0];

    // Délai constant pour éviter les attaques par timing
    const hash = admin ? admin.password_hash : DUMMY_HASH;
    const valid = await bcrypt.compare(password, hash);

    if (!admin || !valid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = signToken({ id: admin.id, username: admin.username, role: 'admin' });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/reset-password
// Permet de changer le mot de passe uniquement si le username admin est connu.
router.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  try {
    const adminResult = await pool.query(
      'SELECT id FROM admins WHERE username = $1',
      [username]
    );
    const admin = adminResult.rows[0];
    if (!admin) {
      return res.status(403).json({ error: 'Username admin invalide' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE admins SET password_hash = $1 WHERE id = $2',
      [passwordHash, admin.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/client/register — auto-inscription client (téléphone + mot de passe)
router.post('/client/register', async (req, res) => {
  const { phone, password, name } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Numéro de téléphone et mot de passe requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    await ensureClientPasswordColumn();

    const existing = await pool.query('SELECT * FROM clients WHERE phone = $1', [phone]);
    if (existing.rows[0]?.password_hash) {
      return res.status(409).json({ error: 'Un compte existe déjà pour ce numéro' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO clients (phone, name, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (phone) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, clients.name),
         password_hash = EXCLUDED.password_hash
       RETURNING id, phone, name, created_at`,
      [phone, name || null, passwordHash]
    );
    const client = result.rows[0];

    const token = signToken({ id: client.id, phone: client.phone, role: 'client' });
    res.status(201).json({ token, client });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/client/forgot-password
// Vérifie que le téléphone et le nom fournis appartiennent au même client
// (pas d'infra SMS/email : c'est le seul contrôle d'identité disponible).
router.post('/client/forgot-password', async (req, res) => {
  const { phone, name, newPassword } = req.body;
  if (!phone || !name || !newPassword) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    await ensureClientPasswordColumn();

    const result = await pool.query(
      `SELECT id FROM clients WHERE phone = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))`,
      [phone, name]
    );
    const client = result.rows[0];
    if (!client) {
      return res.status(404).json({ error: 'Numéro de téléphone ou nom incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE clients SET password_hash = $1 WHERE id = $2', [passwordHash, client.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/client/login
router.post('/client/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    await ensureClientPasswordColumn();

    const result = await pool.query('SELECT * FROM clients WHERE phone = $1', [phone]);
    const client = result.rows[0];

    const hash = client?.password_hash || DUMMY_HASH;
    const valid = await bcrypt.compare(password, hash);

    if (!client || !client.password_hash || !valid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = signToken({ id: client.id, phone: client.phone, role: 'client' });
    res.json({
      token,
      client: { id: client.id, phone: client.phone, name: client.name, created_at: client.created_at },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/gestionnaire/login — pas d'auto-inscription, identifiants provisionnés
router.post('/gestionnaire/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    await ensureGestionnairesTable();

    const result = await pool.query('SELECT * FROM gestionnaires WHERE username = $1', [username]);
    const gestionnaire = result.rows[0];

    const hash = gestionnaire ? gestionnaire.password_hash : DUMMY_HASH;
    const valid = await bcrypt.compare(password, hash);

    if (!gestionnaire || !valid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = signToken({ id: gestionnaire.id, username: gestionnaire.username, role: 'gestionnaire' });
    res.json({
      token,
      gestionnaire: { id: gestionnaire.id, username: gestionnaire.username, name: gestionnaire.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
