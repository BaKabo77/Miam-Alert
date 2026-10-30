import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module.js';
import { LocalRecipeProvider } from './local-recipe.provider.js';
import { RecipeCatalogSync } from './recipe-catalog.sync.js';
import { RecipeProvider } from './recipe-provider.js';
import { RecipesController } from './recipes.controller.js';
import { RecipesService } from './recipes.service.js';

@Module({
  // HouseholdsModule exporte HouseholdAccessService : même contrôle d'appartenance que l'inventaire.
  imports: [HouseholdsModule],
  controllers: [RecipesController],
  providers: [
    RecipesService,
    RecipeCatalogSync,
    // Seul endroit où se choisit la source des suggestions (locale aujourd'hui, IA plus tard).
    { provide: RecipeProvider, useClass: LocalRecipeProvider },
  ],
})
export class RecipesModule {}
