import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecipeProvider } from './recipe-provider.js';
import type { RecipeSuggestion } from './recipes.types.js';
import { type PantryItemForRecipes, scoreRecipes } from './suggestions.js';

// Suggestions tirées de la base de recettes locale (catalogue du code, recopié en base).
@Injectable()
export class LocalRecipeProvider extends RecipeProvider {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async suggest(pantry: PantryItemForRecipes[], limit: number): Promise<RecipeSuggestion[]> {
    if (pantry.length === 0) {
      return [];
    }

    // Quelques dizaines de recettes : toutes chargées, le classement est fait en mémoire. Ordre par
    // titre : à égalité de classement, l'ordre reste le même d'un appel à l'autre.
    const recipes = await this.prisma.recipe.findMany({
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        summary: true,
        servings: true,
        prepMinutes: true,
        cookMinutes: true,
        vegetarian: true,
        ingredients: {
          select: { ingredientKey: true, optional: true, ingredient: { select: { name: true, isStaple: true } } },
        },
      },
    });

    const scored = scoreRecipes(
      recipes.map((recipe) => ({
        id: recipe.id,
        ingredients: recipe.ingredients.map(({ ingredientKey, optional, ingredient }) => ({
          key: ingredientKey,
          name: ingredient.name,
          staple: ingredient.isStaple,
          optional,
        })),
      })),
      pantry,
      limit,
    );

    const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    return scored.map(({ recipeId, urgentCount, soonCount, uses, missing }) => {
      const recipe = byId.get(recipeId)!;
      return {
        recipe: {
          id: recipe.id,
          title: recipe.title,
          summary: recipe.summary,
          servings: recipe.servings,
          totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
          vegetarian: recipe.vegetarian,
        },
        urgentCount,
        soonCount,
        uses,
        missing,
      };
    });
  }
}
