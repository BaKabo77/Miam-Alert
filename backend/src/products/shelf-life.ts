import type { ExpiryType } from '../generated/prisma/client.js';

export interface SuggestedExpiry {
  // Nombre de jours à ajouter à la date d'achat (aujourd'hui).
  days: number;
  expiryType: ExpiryType;
}

// Durées de conservation habituelles d'un produit NON ENTAMÉ, selon sa catégorie Open Food Facts.
// Une simple suggestion pour gagner du temps : l'utilisateur vérifie toujours la date imprimée.
// L'ordre compte : la première règle qui correspond l'emporte, donc les catégories les plus
// précises (et les plus périssables) passent avant les plus générales. Exemple : un yaourt est
// aussi un « produit laitier » ; un plat surgelé est aussi un « plat préparé ».
// Table côté serveur : le client ne choisit jamais la durée, il ne fait que l'afficher.
const RULES: { tags: string[]; days: number; expiryType: ExpiryType }[] = [
  // Conserves et surgelés d'abord : la conservation l'emporte sur la nature de l'aliment.
  { tags: ['en:canned-foods'], days: 730, expiryType: 'DDM' },
  { tags: ['en:frozen-foods'], days: 180, expiryType: 'DDM' },

  // Produits frais. Charcuterie et poisson fumé avant la viande et le poisson : dans la
  // classification d'Open Food Facts, un jambon est AUSSI une viande, un saumon fumé AUSSI un poisson.
  { tags: ['en:hams', 'en:sausages', 'en:prepared-meats'], days: 10, expiryType: 'DLC' },
  { tags: ['en:smoked-fishes'], days: 14, expiryType: 'DLC' },
  { tags: ['en:fishes', 'en:seafood'], days: 2, expiryType: 'DLC' },
  { tags: ['en:meats', 'en:poultries', 'en:fresh-meats'], days: 3, expiryType: 'DLC' },
  { tags: ['en:meals', 'en:fresh-pastas'], days: 5, expiryType: 'DLC' },
  { tags: ['en:creams'], days: 14, expiryType: 'DLC' },
  { tags: ['en:yogurts', 'en:fermented-milk-products', 'en:dairy-desserts'], days: 21, expiryType: 'DLC' },
  { tags: ['en:cheeses'], days: 21, expiryType: 'DLC' },
  { tags: ['en:butters'], days: 60, expiryType: 'DLC' },
  { tags: ['en:eggs'], days: 28, expiryType: 'DDM' },
  { tags: ['en:breads'], days: 4, expiryType: 'DDM' },
  { tags: ['en:fresh-vegetables', 'en:fresh-fruits'], days: 7, expiryType: 'DDM' },
  { tags: ['en:pastries', 'en:cakes'], days: 7, expiryType: 'DDM' },

  // Épicerie.
  { tags: ['en:milks'], days: 90, expiryType: 'DDM' },
  { tags: ['en:fruit-juices', 'en:juices-and-nectars'], days: 180, expiryType: 'DDM' },
  { tags: ['en:waters', 'en:sodas', 'en:carbonated-drinks'], days: 365, expiryType: 'DDM' },
  { tags: ['en:breakfast-cereals'], days: 180, expiryType: 'DDM' },
  { tags: ['en:biscuits', 'en:biscuits-and-cakes'], days: 120, expiryType: 'DDM' },
  { tags: ['en:chocolates', 'en:spreads', 'en:sweet-spreads', 'en:jams'], days: 180, expiryType: 'DDM' },
  { tags: ['en:sauces', 'en:condiments'], days: 180, expiryType: 'DDM' },
  { tags: ['en:pastas', 'en:rices', 'en:cereals-and-their-products', 'en:legumes'], days: 365, expiryType: 'DDM' },
  { tags: ['en:snacks'], days: 120, expiryType: 'DDM' },
  { tags: ['en:beverages'], days: 180, expiryType: 'DDM' },
];

export function suggestExpiry(categories: readonly string[]): SuggestedExpiry | null {
  const tags = new Set(categories);
  const rule = RULES.find((candidate) => candidate.tags.some((tag) => tags.has(tag)));
  return rule ? { days: rule.days, expiryType: rule.expiryType } : null;
}
