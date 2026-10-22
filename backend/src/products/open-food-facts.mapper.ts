import type { ProductData } from './products.types.js';

// Les données d'Open Food Facts sont saisies par des contributeurs et transitent par le réseau :
// elles sont NON FIABLES. Rien n'est stocké sans être vérifié, typé, borné et nettoyé ici.

const MAX_NAME_LENGTH = 200;
const MAX_IMAGE_URL_LENGTH = 500;
const MAX_CATEGORY_LENGTH = 100;

// Seules les images servies en HTTPS par Open Food Facts sont acceptées : une URL quelconque
// ferait charger au navigateur de l'utilisateur une ressource d'un domaine inconnu.
const IMAGE_HOST_SUFFIX = '.openfoodfacts.org';
const CATEGORY_PATTERN = /^en:[a-z0-9-]+$/;
const NUTRISCORE_PATTERN = /^[a-e]$/;

export function toProductData(barcode: string, raw: unknown): ProductData | null {
  if (!isRecord(raw)) {
    return null;
  }

  const name = cleanText(raw.product_name_fr, MAX_NAME_LENGTH) ?? cleanText(raw.product_name, MAX_NAME_LENGTH);
  // Sans nom, la fiche est inutilisable : traitée comme un produit inconnu (saisie manuelle).
  if (!name) {
    return null;
  }

  return {
    barcode,
    name,
    // "Nutella, Ferrero" : on garde la première marque.
    brand: typeof raw.brands === 'string' ? cleanText(raw.brands.split(',')[0], MAX_NAME_LENGTH) : null,
    imageUrl: cleanImageUrl(raw.image_front_url),
    category: cleanCategory(raw.categories_tags),
    nutriscore: cleanNutriscore(raw.nutriscore_grade),
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Texte : caractères de contrôle supprimés, espaces superflus retirés, longueur bornée.
function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.replace(/\p{Cc}/gu, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return text.length > 0 ? text : null;
}

function cleanImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_URL_LENGTH) {
    return null;
  }
  try {
    const url = new URL(value);
    const trusted = url.protocol === 'https:' && url.hostname.endsWith(IMAGE_HOST_SUFFIX);
    return trusted ? url.toString() : null;
  } catch {
    return null;
  }
}

// Premier tag de catégorie bien formé (les tags mal formés, fréquents, sont ignorés).
function cleanCategory(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const tag = value.find(
    (item): item is string =>
      typeof item === 'string' && item.length <= MAX_CATEGORY_LENGTH && CATEGORY_PATTERN.test(item),
  );
  return tag ?? null;
}

// Nutri-Score de A à E ; "unknown", "not-applicable" ou toute autre valeur deviennent null.
function cleanNutriscore(value: unknown): string | null {
  return typeof value === 'string' && NUTRISCORE_PATTERN.test(value) ? value.toUpperCase() : null;
}
