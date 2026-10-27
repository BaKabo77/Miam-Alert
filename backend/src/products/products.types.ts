import type { SuggestedExpiry } from './shelf-life.js';

// Données nettoyées, prêtes à être stockées : tout ce qui vient d'Open Food Facts passe par là.
export interface ProductData {
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  // Premier tag de catégorie (le plus général).
  category: string | null;
  // Tous les tags de catégorie, utilisés pour suggérer une date ; non renvoyés au client.
  categories: string[];
  nutriscore: string | null;
}

// Fiche produit telle qu'elle sort de l'API.
export interface ProductResponse extends Omit<ProductData, 'categories'> {
  id: string;
  // Date de péremption habituelle pour ce type de produit (null si la catégorie est inconnue).
  suggestedExpiry: SuggestedExpiry | null;
}
