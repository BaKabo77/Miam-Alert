import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { INGREDIENTS } from './catalog/ingredients.js';
import { RECIPES } from './catalog/recipes.js';
import { matchIngredient } from './ingredient-matcher.js';

const CATALOG_NAME = 'recipes';

// Recopie le catalogue du code (ingrédients et recettes) en base au démarrage de l'API.
// - Rien n'est fait si le catalogue n'a pas changé depuis la dernière fois (empreinte en base).
// - Sinon, tout est mis à jour dans UNE transaction : la base n'est jamais à moitié synchronisée.
// - Les articles des inventaires sont ensuite reconnus de nouveau, pour profiter d'un ingrédient ou
//   d'un mot-clé ajouté.
// Aucune donnée personnelle n'est lue ni écrite ici, à part l'ingrédient reconnu des articles.
@Injectable()
export class RecipeCatalogSync implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecipeCatalogSync.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sync();
  }

  // Renvoie true si la base a été mise à jour.
  async sync(): Promise<boolean> {
    const hash = createHash('sha256').update(JSON.stringify({ INGREDIENTS, RECIPES })).digest('hex');
    const current = await this.prisma.catalogVersion.findUnique({ where: { name: CATALOG_NAME } });
    if (current?.hash === hash) {
      return false;
    }

    const recognized = await this.prisma.$transaction(
      async (tx) => {
        for (const { key, name, staple = false } of INGREDIENTS) {
          await tx.ingredient.upsert({
            where: { key },
            create: { key, name, isStaple: staple },
            update: { name, isStaple: staple },
          });
        }

        for (const { slug, ingredients, ...fields } of RECIPES) {
          const { id } = await tx.recipe.upsert({
            where: { slug },
            create: { slug, ...fields },
            update: fields,
            select: { id: true },
          });
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: ingredients.map(({ key, quantity, optional = false }, position) => ({
              recipeId: id,
              ingredientKey: key,
              quantity,
              optional,
              position,
            })),
          });
        }

        // Ce qui a disparu du catalogue disparaît de la base. Un ingrédient supprimé laisse les
        // articles en place, simplement non reconnus (SetNull).
        await tx.recipe.deleteMany({ where: { slug: { notIn: RECIPES.map(({ slug }) => slug) } } });
        await tx.ingredient.deleteMany({ where: { key: { notIn: INGREDIENTS.map(({ key }) => key) } } });

        const count = await this.recognizePantryItems(tx);
        await tx.catalogVersion.upsert({
          where: { name: CATALOG_NAME },
          create: { name: CATALOG_NAME, hash },
          update: { hash },
        });
        return count;
      },
      // Plusieurs centaines de requêtes : au-delà des 5 s par défaut d'une transaction Prisma.
      { timeout: 60_000 },
    );

    // Des nombres seulement dans les logs.
    this.logger.log(
      `Recipe catalog synced: ${INGREDIENTS.length} ingredient(s), ${RECIPES.length} recipe(s), ${recognized} pantry item(s) re-recognized`,
    );
    return true;
  }

  // Reconnaît de nouveau tous les articles, et n'écrit que ceux dont l'ingrédient change (regroupés
  // par ingrédient : une requête par ingrédient, pas une par article).
  private async recognizePantryItems(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]): Promise<number> {
    const items = await tx.pantryItem.findMany({
      select: { id: true, name: true, ingredientKey: true, product: { select: { categories: true } } },
    });
    const changes = new Map<string | null, string[]>();
    for (const item of items) {
      const key = matchIngredient({ name: item.name, categories: item.product?.categories });
      if (key !== item.ingredientKey) {
        changes.set(key, [...(changes.get(key) ?? []), item.id]);
      }
    }
    for (const [ingredientKey, ids] of changes) {
      await tx.pantryItem.updateMany({ where: { id: { in: ids } }, data: { ingredientKey } });
    }
    return [...changes.values()].reduce((total, ids) => total + ids.length, 0);
  }
}
