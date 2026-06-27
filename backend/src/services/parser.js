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

module.exports = { parseMessage, CATEGORIES };
