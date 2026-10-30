import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RecipeSuggestionsQuery } from './dto/recipe-suggestions.query.js';
import { RecipesService } from './recipes.service.js';
import type { RecipeDetailResponse, RecipeSuggestionsResponse } from './recipes.types.js';

// Routes protégées (aucune n'est @Public()) : access token obligatoire.
@Controller()
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  // Membres du foyer uniquement : le service vérifie l'appartenance (404 pour le foyer d'un autre).
  @Get('households/:householdId/recipes/suggestions')
  suggest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query() query: RecipeSuggestionsQuery,
  ): Promise<RecipeSuggestionsResponse> {
    return this.recipes.suggest(user.id, householdId, query.limit);
  }

  // Tout utilisateur connecté : le catalogue de recettes est public et ne contient aucune donnée de
  // foyer. Le token reste exigé, comme pour les fiches produits (pas de relais anonyme).
  @Get('recipes/:recipeId')
  findOne(@Param('recipeId', ParseUUIDPipe) recipeId: string): Promise<RecipeDetailResponse> {
    return this.recipes.findOne(recipeId);
  }
}
