import { Injectable, NotFoundException } from '@nestjs/common';
import { HouseholdAccessService } from '../households/household-access.service.js';
import { todayUtc } from '../pantry/dates.js';
import { computeUrgency, daysUntil } from '../pantry/urgency.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecipeProvider } from './recipe-provider.js';
import type { RecipeDetailResponse, RecipeSuggestionsResponse } from './recipes.types.js';

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly householdAccess: HouseholdAccessService,
    private readonly provider: RecipeProvider,
  ) {}

  // Suggestions pour l'inventaire d'un foyer, réservées à ses membres (404 sinon, comme l'inventaire).
  async suggest(userId: string, householdId: string, limit: number): Promise<RecipeSuggestionsResponse> {
    await this.householdAccess.assertMember(userId, householdId);

    // Articles actifs et reconnus du foyer : l'urgence est calculée comme pour l'inventaire, si bien
    // que les suggestions et les badges de l'application sont toujours d'accord.
    const items = await this.prisma.pantryItem.findMany({
      where: { householdId, status: 'ACTIVE', ingredientKey: { not: null } },
      select: { id: true, name: true, ingredientKey: true, expiryDate: true, expiryType: true },
    });
    const today = todayUtc();
    const pantry = items.map(({ id, name, ingredientKey, expiryDate, expiryType }) => ({
      id,
      name,
      ingredientKey: ingredientKey!,
      urgency: computeUrgency(expiryDate, expiryType, today),
      daysLeft: daysUntil(expiryDate, today),
    }));

    return { suggestions: await this.provider.suggest(pantry, limit) };
  }

  // Recette complète du catalogue public : aucune donnée de foyer, pas de contrôle d'appartenance.
  async findOne(recipeId: string): Promise<RecipeDetailResponse> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        title: true,
        summary: true,
        servings: true,
        prepMinutes: true,
        cookMinutes: true,
        vegetarian: true,
        steps: true,
        ingredients: {
          orderBy: { position: 'asc' },
          select: { quantity: true, optional: true, ingredient: { select: { name: true, isStaple: true } } },
        },
      },
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const { ingredients, ...fields } = recipe;
    return {
      ...fields,
      ingredients: ingredients.map(({ quantity, optional, ingredient }) => ({
        name: ingredient.name,
        quantity,
        optional,
        staple: ingredient.isStaple,
      })),
    };
  }
}
