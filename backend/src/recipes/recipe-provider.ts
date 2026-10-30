import type { RecipeSuggestion } from './recipes.types.js';
import type { PantryItemForRecipes } from './suggestions.js';

// Source de suggestions de recettes. Le reste de l'application ne dépend que de ce contrat :
// - LocalRecipeProvider : base de recettes locale, gratuite (v0.7) ;
// - plus tard, AiRecipeProvider : recettes générées par IA (offre Premium). Il recevra les mêmes
//   articles, devra traiter leurs noms comme de simples données (injection de prompt), valider la
//   réponse du modèle par un schéma et respecter des quotas par utilisateur AVANT tout appel.
// Le choix de l'implémentation se fait à un seul endroit : recipes.module.ts.
export abstract class RecipeProvider {
  // Articles ACTIFS du foyer, déjà reconnus (ingrédient connu), avec leur urgence.
  abstract suggest(pantry: PantryItemForRecipes[], limit: number): Promise<RecipeSuggestion[]>;
}
