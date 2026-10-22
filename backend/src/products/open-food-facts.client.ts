import { Injectable } from '@nestjs/common';
import { isRecord, toProductData } from './open-food-facts.mapper.js';
import type { ProductData } from './products.types.js';

const BASE_URL = 'https://world.openfoodfacts.org';
// On ne demande que les champs utiles : réponse plus petite, et moins de données non fiables.
const FIELDS = [
  'product_name',
  'product_name_fr',
  'brands',
  'image_front_url',
  'categories_tags',
  'nutriscore_grade',
].join(',');
// Au-delà, on abandonne : un service lent ne doit pas bloquer nos requêtes indéfiniment.
const TIMEOUT_MS = 5_000;
// Open Food Facts demande que chaque application s'identifie.
const USER_AGENT = 'MiamAlert/0.1 (https://gitlab.com/BaKabo77/miam-alert)';

// Open Food Facts injoignable, trop lent ou réponse inexploitable.
export class OpenFoodFactsUnavailableError extends Error {}

@Injectable()
export class OpenFoodFactsClient {
  // Renvoie la fiche nettoyée, ou null si le produit est inconnu d'Open Food Facts.
  async fetchProduct(barcode: string): Promise<ProductData | null> {
    // URL construite avec l'API URL, pas par concaténation : le code-barres (déjà validé)
    // est encodé, il ne peut pas modifier le chemin ni ajouter de paramètres.
    const url = new URL(`/api/v2/product/${encodeURIComponent(barcode)}`, BASE_URL);
    url.searchParams.set('fields', FIELDS);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Pas de redirection suivie : la réponse ne peut venir que du serveur prévu.
        redirect: 'error',
      });
    } catch (error) {
      throw new OpenFoodFactsUnavailableError('Request failed', { cause: error });
    }

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new OpenFoodFactsUnavailableError(`Unexpected status ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new OpenFoodFactsUnavailableError('Invalid response body', { cause: error });
    }

    // Produit inconnu : Open Food Facts répond souvent 200 avec "status": 0.
    if (!isRecord(body) || body.status !== 1) {
      return null;
    }
    return toProductData(barcode, body.product);
  }
}
