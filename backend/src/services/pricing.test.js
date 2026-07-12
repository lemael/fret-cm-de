const { computePriceEur, DEFAULT_CONFIG } = require('./pricing');

// Fixtures au format snake_case, tel que renvoyé par une vraie ligne `shipments` (pg).
describe('computePriceEur', () => {
  test('applique le prix forfaitaire XL depuis size_category', () => {
    const price = computePriceEur({ size_category: 'XL', weight_kg: '12' }, DEFAULT_CONFIG);
    expect(price).toBe(40);
  });

  test('applique le prix forfaitaire XXL depuis size_category', () => {
    const price = computePriceEur({ size_category: 'XXL', weight_kg: '20' }, DEFAULT_CONFIG);
    expect(price).toBe(50);
  });

  test('applique le prix forfaitaire du palier volumétrique', () => {
    const price = computePriceEur({ size_category: 'VOLUMETRIC_1M3', weight_kg: '400' }, DEFAULT_CONFIG);
    expect(price).toBe(850);
  });

  test('calcule le prix au kg pour une catégorie BULK à partir du poids exact', () => {
    const price = computePriceEur({ size_category: 'BULK_1000_1999', weight_kg: '1500' }, DEFAULT_CONFIG);
    expect(price).toBe(1500 * 1.5);
  });

  test('retombe sur le calcul par dimensions quand aucune size_category n\'est fournie', () => {
    const price = computePriceEur(
      { weight_kg: '15', length_cm: '40', width_cm: '20', height_cm: '15' },
      DEFAULT_CONFIG
    );
    expect(price).toBe(40); // span = 40+15 = 55 <= 75, poids 15 <= 18 -> XL
  });

  test('retourne null si le poids est manquant ou nul', () => {
    expect(computePriceEur({ size_category: 'BULK_3000_PLUS' }, DEFAULT_CONFIG)).toBeNull();
    expect(computePriceEur({}, DEFAULT_CONFIG)).toBeNull();
  });

  test('retourne null si aucune tranche ne correspond (dimensions hors grille, pas de size_category)', () => {
    // 600 kg : trop lourd pour XL/XXL, trop léger pour un palier BULK (>=1000kg),
    // et un petit volume (10x10x10cm) qui ne déclenche pas le palier volumétrique.
    const price = computePriceEur(
      { weight_kg: '600', length_cm: '10', width_cm: '10', height_cm: '10' },
      DEFAULT_CONFIG
    );
    expect(price).toBeNull();
  });
});
