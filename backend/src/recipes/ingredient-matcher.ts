import { INGREDIENTS, type IngredientDefinition } from './catalog/ingredients.js';

// Reconnaît l'ingrédient d'un article de l'inventaire. Fonction pure : aucun accès à la base, le
// résultat ne dépend que de la fiche produit et du nom. Toujours calculée par le serveur : le client
// ne choisit jamais l'ingrédient (il pourrait sinon fausser les suggestions de son foyer, rien de plus,
// mais la règle reste la même que pour toute donnée dérivée).

export interface ItemToMatch {
  name: string;
  // Catégories Open Food Facts de la fiche produit, de la plus générale à la plus précise.
  categories?: readonly string[];
}

// Minuscules, sans accents ni ligatures, ponctuation remplacée par des espaces : « Œufs frais (x6) »
// devient « oeufs frais x6 ». Les mots-clés du catalogue sont écrits sous cette forme.
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Index construits une seule fois au chargement du module.
const BY_TAG = new Map<string, string>();
const KEYWORDS: { keyword: string; key: string }[] = [];
for (const ingredient of INGREDIENTS as IngredientDefinition[]) {
  for (const tag of ingredient.offTags ?? []) {
    BY_TAG.set(tag, ingredient.key);
  }
  for (const keyword of ingredient.keywords) {
    KEYWORDS.push({ keyword, key: ingredient.key });
  }
}
// Le mot-clé le plus long l'emporte : « pommes de terre » avant « pommes », « lait de coco » avant « lait ».
KEYWORDS.sort((a, b) => b.keyword.length - a.keyword.length);

export function matchIngredient(item: ItemToMatch): string | null {
  // 1. Produit scanné : la catégorie la plus précise reconnue (la liste va du général au précis).
  const categories = item.categories ?? [];
  for (let index = categories.length - 1; index >= 0; index--) {
    const key = BY_TAG.get(categories[index]);
    if (key) {
      return key;
    }
  }

  // 2. Nom : un mot-clé présent en mots entiers (« pain » ne reconnaît pas « painvin »).
  const name = ` ${normalizeName(item.name)} `;
  const match = KEYWORDS.find(({ keyword }) => name.includes(` ${keyword} `));
  return match?.key ?? null;
}
