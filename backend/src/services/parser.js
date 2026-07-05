/**
 * Moteur d'analyse de messages WhatsApp.
 * Phase 1 : regex simples — évoluera vers NLP/OpenAI en Phase 3.
 */

const CATEGORIES = {
  ARRIVAL: /arriv[eé]|conteneur|c['']est quand|quand.*(bateau|avion|livraison)|suivi|tracking|où en est|statut.*colis/i,
  CLAIM: /cass[eé]|perdu|pas reç[eu]|probl[eè]me|réclamation|abîm[eé]|manquant|détérior[eé]|endommagé/i,
  SHIPMENT: /envoyer|expédi[er]|poids|combien.*coût[e]|tarif|veux envoyer|nouvelle expédition|kilo|kg/i,
  SCHEDULE: /prochain.*(départ|envoi)|calendrier|planning|dates?.*départ|quand.*prochain|programme/i,
  CUSTOMS: /autoris[eé]|interdit|douane|liste.*produit|peut-on envoyer|est-ce qu['']on peut|produit.*cameroun/i,
};

/**
 * Analyse un message et retourne sa catégorie.
 * @param {string} text
 * @returns {'ARRIVAL'|'CLAIM'|'SHIPMENT'|'SCHEDULE'|'CUSTOMS'|'UNKNOWN'}
 */
function parseMessage(text) {
  if (!text || typeof text !== 'string') return 'UNKNOWN';
  for (const [category, regex] of Object.entries(CATEGORIES)) {
    if (regex.test(text)) return category;
  }
  return 'UNKNOWN';
}

const parseProductList = (text) => {
  const explicitProducts = text.match(/produits?\s*[:=-]\s*([^\n]+)/i);
  if (explicitProducts && explicitProducts[1]) {
    return explicitProducts[1]
      .split(/[,;|/]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const bulletProducts = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);

  return bulletProducts;
};

const parseDimensions = (text) => {
  const dimensionMatch = text.match(
    /(\d{1,4}(?:[.,]\d+)?)\s*[xX*]\s*(\d{1,4}(?:[.,]\d+)?)\s*[xX*]\s*(\d{1,4}(?:[.,]\d+)?)(?:\s*(cm|mm|m))?/i
  );

  if (!dimensionMatch) {
    return null;
  }

  const toNumber = (raw) => Number(String(raw).replace(',', '.'));

  return {
    length: toNumber(dimensionMatch[1]),
    width: toNumber(dimensionMatch[2]),
    height: toNumber(dimensionMatch[3]),
    unit: (dimensionMatch[4] || 'cm').toLowerCase(),
  };
};

function extractShipmentDetails(text, { clientName, clientPhone } = {}) {
  const products = parseProductList(text || '');
  const dimensions = parseDimensions(text || '');

  const parcel = {
    clientName: clientName || null,
    clientPhone: clientPhone || null,
    products,
    dimensions,
  };

  const missingFields = [];
  if (!parcel.clientName) missingFields.push('clientName');
  if (!parcel.clientPhone) missingFields.push('clientPhone');
  if (!parcel.products.length) missingFields.push('products');
  if (!parcel.dimensions) missingFields.push('dimensions');

  return {
    parcel,
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

module.exports = { parseMessage, CATEGORIES, extractShipmentDetails };
