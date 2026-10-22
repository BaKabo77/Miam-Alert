// Fiche produit telle qu'elle sort de l'API (et telle qu'elle est stockée dans le cache).
export interface ProductResponse {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  category: string | null;
  nutriscore: string | null;
}

// Données nettoyées, prêtes à être stockées : tout ce qui vient d'Open Food Facts passe par là.
export type ProductData = Omit<ProductResponse, 'id'>;
