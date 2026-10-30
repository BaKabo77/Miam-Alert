import type { Urgency } from '../pantry/urgency.js';

// Ce qui sort de l'API pour une suggestion : la recette en résumé, ce qu'elle utilise de
// l'inventaire et ce qu'il manque. Les articles sont ceux du foyer de l'utilisateur (accès vérifié).
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
  uses: { itemId: string; itemName: string; ingredientName: string; urgency: Urgency; daysLeft: number }[];
  missing: string[];
}

// Enveloppe : « aucune suggestion » est une réponse normale (liste vide), pas une erreur.
export interface RecipeSuggestionsResponse {
  suggestions: RecipeSuggestion[];
}

// Recette complète. Catalogue public : aucune donnée de foyer.
export interface RecipeDetailResponse {
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
