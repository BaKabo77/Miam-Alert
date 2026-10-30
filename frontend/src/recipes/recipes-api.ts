import { apiRequest } from '../lib/api';
import type { PantryItem } from '../pantry/pantry-api';

// Une suggestion telle que l'API la renvoie (voir RecipeSuggestion côté backend).
export interface RecipeSuggestion {
  recipe: {
    id: string;
    title: string;
    summary: string;
    servings: number;
    totalMinutes: number;
    vegetarian: boolean;
  };
  urgentCount: number;
  soonCount: number;
  // Articles de l'inventaire que la recette utilise (le plus urgent pour chaque ingrédient).
  uses: { itemId: string; itemName: string; ingredientName: string; urgency: PantryItem['urgency']; daysLeft: number }[];
  // Ingrédients à acheter (jamais les basiques du placard ni les facultatifs).
  missing: string[];
}

// Recette complète (voir RecipeDetailResponse côté backend).
export interface Recipe {
  id: string;
  title: string;
  summary: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  vegetarian: boolean;
  ingredients: { name: string; quantity: string; optional: boolean; staple: boolean }[];
  steps: string[];
}

// Toujours le maximum (20) : la page Recettes, l'idée de l'inventaire et la fiche d'une recette
// partagent ainsi le même cache, sans appel en double.
const SUGGESTIONS_LIMIT = 20;

export async function fetchSuggestions(householdId: string): Promise<RecipeSuggestion[]> {
  const { suggestions } = await apiRequest<{ suggestions: RecipeSuggestion[] }>(
    `/households/${encodeURIComponent(householdId)}/recipes/suggestions?limit=${SUGGESTIONS_LIMIT}`,
  );
  return suggestions;
}

export function fetchRecipe(recipeId: string): Promise<Recipe> {
  return apiRequest<Recipe>(`/recipes/${encodeURIComponent(recipeId)}`);
}

// "75" → "1 h 15", "20" → "20 min".
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, '0')}`;
}
