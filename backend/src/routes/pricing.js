const express = require('express');
const { authenticateAny, requireRole } = require('../middleware/auth');
const { getPricingConfig, savePricingConfig, validateConfig } = require('../services/pricing');

const router = express.Router();

// GET /api/pricing — grille de prix, visible par les 3 profils (admin, client, gestionnaire)
router.get('/', authenticateAny, async (_req, res) => {
  try {
    const config = await getPricingConfig();
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/pricing — modification de la grille, admin uniquement
router.put('/', requireRole('admin'), async (req, res) => {
  const { config } = req.body;
  if (!validateConfig(config)) {
    return res.status(400).json({ error: 'Grille de prix invalide' });
  }

  try {
    await savePricingConfig(config);
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
