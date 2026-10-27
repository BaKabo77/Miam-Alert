import { apiRequest } from '../lib/api';

// Fiche produit renvoyée par l'API (cache des données Open Food Facts).
export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  category: string | null;
  nutriscore: string | null;
  // Durée de conservation habituelle pour ce type de produit (calculée par l'API).
  suggestedExpiry: { days: number; expiryType: 'DLC' | 'DDM' } | null;
}

export function fetchProduct(barcode: string): Promise<Product> {
  return apiRequest<Product>(`/products/${encodeURIComponent(barcode)}`);
}
