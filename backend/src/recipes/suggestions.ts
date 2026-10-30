import type { Urgency } from '../pantry/urgency.js';

// Classement des recettes selon l'inventaire d'un foyer. Fonction pure, testée unitairement :
// c'est le cœur anti-gaspi de l'application.
//
// Ordre de priorité (pas de score pondéré : une somme de poids laisse toujours des cas où plusieurs
// produits qui peuvent attendre l'emportent sur un produit à manger aujourd'hui) :
//   1. le nombre de produits URGENTS que la recette sauve (à consommer sous 2 jours, ou DDM dépassée) ;
//   2. puis le nombre de produits à consommer CETTE SEMAINE ;
//   3. puis la part des ingrédients nécessaires déjà à la maison ;
//   4. puis le moins de courses ; à égalité, l'ordre du catalogue.
//
// Un produit à DLC dépassée (EXPIRED) n'est JAMAIS proposé en cuisine : risque sanitaire. Une DDM
// dépassée reste consommable : elle compte comme urgente.

export interface PantryItemForRecipes {
  id: string;
  name: string;
  ingredientKey: string;
  urgency: Urgency;
  daysLeft: number;
}

export interface RecipeForScoring {
  id: string;
  ingredients: { key: string; name: string; staple: boolean; optional: boolean }[];
}

export interface ScoredRecipe {
  recipeId: string;
  // Produits urgents et de la semaine que la recette utilise.
  urgentCount: number;
  soonCount: number;
  // Articles de l'inventaire que la recette utilise (le plus urgent pour chaque ingrédient).
  uses: { itemId: string; itemName: string; ingredientName: string; urgency: Urgency; daysLeft: number }[];
  // Ingrédients nécessaires absents de l'inventaire (ni basiques, ni facultatifs).
  missing: string[];
  // Part des ingrédients nécessaires déjà présents (0 à 1).
  coverage: number;
}

const URGENT_LEVELS: ReadonlySet<Urgency> = new Set(['URGENT', 'PAST_BEST_BEFORE']);

export function scoreRecipes(recipes: RecipeForScoring[], pantry: PantryItemForRecipes[], limit: number): ScoredRecipe[] {
  // Pour chaque ingrédient, l'article le plus urgent : c'est lui que la recette doit sauver.
  const bestItem = new Map<string, PantryItemForRecipes>();
  for (const item of pantry) {
    if (item.urgency === 'EXPIRED') {
      continue; // DLC dépassée : jamais proposée
    }
    const current = bestItem.get(item.ingredientKey);
    if (!current || item.daysLeft < current.daysLeft) {
      bestItem.set(item.ingredientKey, item);
    }
  }

  const scored: ScoredRecipe[] = [];
  for (const recipe of recipes) {
    const result: ScoredRecipe = { recipeId: recipe.id, urgentCount: 0, soonCount: 0, uses: [], missing: [], coverage: 0 };
    let required = 0;
    let usesRealIngredient = false;

    for (const ingredient of recipe.ingredients) {
      const item = bestItem.get(ingredient.key);
      const counts = !ingredient.staple && !ingredient.optional;
      required += counts ? 1 : 0;

      if (!item) {
        if (counts) {
          result.missing.push(ingredient.name);
        }
        continue;
      }
      // Un basique ou un facultatif présent et urgent compte aussi : la recette aide à le finir.
      usesRealIngredient ||= counts;
      result.urgentCount += URGENT_LEVELS.has(item.urgency) ? 1 : 0;
      result.soonCount += item.urgency === 'SOON' ? 1 : 0;
      result.uses.push({
        itemId: item.id,
        itemName: item.name,
        ingredientName: ingredient.name,
        urgency: item.urgency,
        daysLeft: item.daysLeft,
      });
    }

    // Une recette qui n'utilise aucun ingrédient « réel » de l'inventaire n'aide pas à gaspiller moins.
    if (!usesRealIngredient) {
      continue;
    }
    result.coverage = (required - result.missing.length) / required;
    scored.push(result);
  }

  return scored
    .sort(
      (a, b) =>
        b.urgentCount - a.urgentCount ||
        b.soonCount - a.soonCount ||
        b.coverage - a.coverage ||
        a.missing.length - b.missing.length,
    )
    .slice(0, limit);
}
