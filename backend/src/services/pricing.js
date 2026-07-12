const pool = require('../config/db');

// Grille tarifaire par défaut — Phiju Agency (Allgemeine Geschäftsbedingungen 2026, page 7).
// Modifiable en base par l'admin via /api/pricing ; ces valeurs ne servent que de repli
// tant qu'aucune configuration n'a encore été enregistrée.
const DEFAULT_CONFIG = {
  sizeTiers: [
    { label: 'XL', maxSpanCm: 75, maxWeightKg: 18, priceEur: 40, bulkMinCartons: 10, bulkDiscountEur: 5 },
    { label: 'XXL', maxSpanCm: 80, maxWeightKg: 25, priceEur: 50, bulkMinCartons: 10, bulkDiscountEur: 10 },
  ],
  bulkKgTiers: [
    { minWeightKg: 1000, pricePerKg: 1.5 },
    { minWeightKg: 2000, pricePerKg: 1.3 },
    { minWeightKg: 3000, pricePerKg: 1.1 },
  ],
  volumetricBracket: { minVolumeM3: 1, maxWeightKg: 520, priceEur: 850 },
};

// Catégorie choisie par le client dans l'app (remplace la saisie de dimensions) —
// pour XL/XXL/volumétrique, associe directement le prix forfaitaire du palier.
const priceEurFromSizeCategory = (sizeCategory, config) => {
  if (sizeCategory === 'XL' || sizeCategory === 'XXL') {
    const tier = config.sizeTiers.find((t) => t.label === sizeCategory);
    return tier ? tier.priceEur : null;
  }
  if (sizeCategory === 'VOLUMETRIC_1M3') {
    return config.volumetricBracket.priceEur;
  }
  // Les catégories BULK_* n'ont pas de prix fixe : le poids exact (saisi séparément)
  // détermine le tarif au kg via la logique ci-dessous.
  return null;
};

// Calcule le prix (EUR) d'une commande à partir du poids, des dimensions, et/ou
// de la catégorie de taille choisie par le client (app client).
// Prend directement une ligne `shipments` (colonnes snake_case telles que renvoyées par pg).
// Retourne null si aucune tranche tarifaire connue ne s'applique (prix à définir manuellement).
const computePriceEur = (
  { weight_kg, length_cm, width_cm, height_cm, size_category },
  config = DEFAULT_CONFIG
) => {
  if (size_category) {
    const categoryPrice = priceEurFromSizeCategory(size_category, config);
    if (categoryPrice !== null) return categoryPrice;
  }

  const weight = Number(weight_kg);
  if (!weight || weight <= 0) return null;

  const bulkTier = [...config.bulkKgTiers]
    .sort((a, b) => b.minWeightKg - a.minWeightKg)
    .find((tier) => weight >= tier.minWeightKg);
  if (bulkTier) return Number((weight * bulkTier.pricePerKg).toFixed(2));

  const length = Number(length_cm);
  const width = Number(width_cm);
  const height = Number(height_cm);
  if (!length || !width || !height) return null;

  const dims = [length, width, height];
  const span = Math.max(...dims) + Math.min(...dims);
  const volumeM3 = (length * width * height) / 1_000_000;

  const { volumetricBracket } = config;
  if (volumeM3 >= volumetricBracket.minVolumeM3 && weight <= volumetricBracket.maxWeightKg) {
    return volumetricBracket.priceEur;
  }

  const sizeTier = config.sizeTiers.find((tier) => span <= tier.maxSpanCm && weight <= tier.maxWeightKg);
  return sizeTier ? sizeTier.priceEur : null;
};

let sizeCategoryColumnEnsured = false;
const ensureSizeCategoryColumn = async () => {
  if (sizeCategoryColumnEnsured) return;
  await pool.query('ALTER TABLE shipments ADD COLUMN IF NOT EXISTS size_category VARCHAR(30)');
  sizeCategoryColumnEnsured = true;
};

let pricingTableEnsured = false;
const ensurePricingTable = async () => {
  if (pricingTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pricing_config (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      config     JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW(),
      CHECK (id = 1)
    )
  `);
  pricingTableEnsured = true;
};

const getPricingConfig = async () => {
  await ensurePricingTable();
  const result = await pool.query('SELECT config FROM pricing_config WHERE id = 1');
  return result.rows[0]?.config || DEFAULT_CONFIG;
};

const savePricingConfig = async (config) => {
  await ensurePricingTable();
  await pool.query(
    `INSERT INTO pricing_config (id, config, updated_at) VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET config = $1, updated_at = NOW()`,
    [config]
  );
};

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const validateConfig = (config) => {
  if (!config || typeof config !== 'object') return false;
  const { sizeTiers, bulkKgTiers, volumetricBracket } = config;

  if (!Array.isArray(sizeTiers) || sizeTiers.length !== 2) return false;
  if (
    !sizeTiers.every(
      (tier) =>
        tier &&
        typeof tier.label === 'string' &&
        isFiniteNumber(tier.maxSpanCm) &&
        isFiniteNumber(tier.maxWeightKg) &&
        isFiniteNumber(tier.priceEur) &&
        isFiniteNumber(tier.bulkMinCartons) &&
        isFiniteNumber(tier.bulkDiscountEur)
    )
  ) {
    return false;
  }

  if (!Array.isArray(bulkKgTiers) || bulkKgTiers.length !== 3) return false;
  if (
    !bulkKgTiers.every(
      (tier) => tier && isFiniteNumber(tier.minWeightKg) && isFiniteNumber(tier.pricePerKg)
    )
  ) {
    return false;
  }

  if (
    !volumetricBracket ||
    !isFiniteNumber(volumetricBracket.minVolumeM3) ||
    !isFiniteNumber(volumetricBracket.maxWeightKg) ||
    !isFiniteNumber(volumetricBracket.priceEur)
  ) {
    return false;
  }

  return true;
};

module.exports = {
  DEFAULT_CONFIG,
  computePriceEur,
  getPricingConfig,
  savePricingConfig,
  validateConfig,
  ensureSizeCategoryColumn,
};
