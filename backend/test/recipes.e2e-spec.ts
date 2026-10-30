import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RecipeCatalogSync } from '../src/recipes/recipe-catalog.sync.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

// Date "YYYY-MM-DD" dans `days` jours (UTC, comme l'API).
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('Recipes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let marie: TestUser;
  let paul: TestUser;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    marie = await createTestUser(app, 'marie@example.com');
    paul = await createTestUser(app, 'paul@example.com');
  });

  afterEach(async () => {
    await app.close();
  });

  const addItem = (user: TestUser, body: object) =>
    request(app.getHttpServer())
      .post(`/households/${user.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ expiryType: 'DLC', ...body })
      .expect(201);

  const suggestions = (user: TestUser, householdId = user.householdId, query = '') =>
    request(app.getHttpServer())
      .get(`/households/${householdId}/recipes/suggestions${query}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

  describe('GET /households/:householdId/recipes/suggestions', () => {
    it('suggests first the recipes that use the most urgent products, with what they use and what is missing', async () => {
      const eggs = await addItem(marie, { name: 'Œufs bio', expiryDate: inDays(1) });
      await addItem(marie, { name: 'Champignons de Paris', expiryDate: inDays(5) });

      const res = await suggestions(marie).expect(200);

      const titles = res.body.suggestions.map((s: { recipe: { title: string } }) => s.recipe.title);
      expect(titles[0]).toBe('Omelette aux champignons');
      const [first] = res.body.suggestions;
      expect(first).toMatchObject({ urgentCount: 1, soonCount: 1 });
      expect(first.uses).toContainEqual(
        expect.objectContaining({ itemId: eggs.body.id, itemName: 'Œufs bio', ingredientName: 'Œufs', urgency: 'URGENT' }),
      );
      // Basiques (sel, poivre, herbes) et facultatifs (fromage râpé) ne sont jamais « manquants ».
      expect(first.missing).toEqual(['Beurre']);
      expect(first.recipe).toEqual({
        id: expect.any(String),
        title: 'Omelette aux champignons',
        summary: expect.any(String),
        servings: 2,
        totalMinutes: 20,
        vegetarian: true,
      });
    });

    it('never suggests cooking a product past its DLC (health risk), but still uses one past its DDM', async () => {
      await addItem(marie, { name: 'Œufs', expiryDate: inDays(-1), expiryType: 'DLC' });
      expect((await suggestions(marie).expect(200)).body.suggestions).toEqual([]);

      await addItem(marie, { name: 'Pâtes', expiryDate: inDays(-10), expiryType: 'DDM' });
      const res = await suggestions(marie).expect(200);
      expect(res.body.suggestions.length).toBeGreaterThan(0);
      for (const suggestion of res.body.suggestions) {
        expect(suggestion.uses.map((use: { itemName: string }) => use.itemName)).not.toContain('Œufs');
      }
    });

    it('ignores consumed, wasted or frozen items, and unknown products', async () => {
      const eggs = await addItem(marie, { name: 'Œufs', expiryDate: inDays(1) });
      await request(app.getHttpServer())
        .patch(`/pantry-items/${eggs.body.id}`)
        .set('Authorization', `Bearer ${marie.accessToken}`)
        .send({ status: 'CONSUMED' })
        .expect(200);
      await addItem(marie, { name: 'Croquettes pour chat', expiryDate: inDays(1) });

      expect((await suggestions(marie).expect(200)).body.suggestions).toEqual([]);
    });

    it('returns at most `limit` suggestions, between 1 and 20', async () => {
      await addItem(marie, { name: 'Œufs', expiryDate: inDays(1) });

      expect((await suggestions(marie, undefined, '?limit=2').expect(200)).body.suggestions).toHaveLength(2);
      for (const limit of ['0', '21', 'abc', '2.5']) {
        await suggestions(marie, undefined, `?limit=${limit}`).expect(400);
      }
      await suggestions(marie, undefined, '?limit=5&householdId=x').expect(400);
    });

    it("cannot read another household's suggestions, and gets the same answer as for a non-existent one", async () => {
      await addItem(marie, { name: 'Œufs', expiryDate: inDays(1) });

      const foreign = await suggestions(paul, marie.householdId).expect(404);
      const missing = await suggestions(paul, randomUUID()).expect(404);
      expect(foreign.body).toEqual(missing.body);
    });

    it('rejects a malformed household id and requires an access token', async () => {
      await suggestions(marie, 'not-a-uuid').expect(400);
      await request(app.getHttpServer()).get(`/households/${marie.householdId}/recipes/suggestions`).expect(401);
    });
  });

  describe('GET /recipes/:recipeId', () => {
    it('returns the full recipe, with its ingredients in order', async () => {
      const recipe = await prisma.recipe.findUniqueOrThrow({ where: { slug: 'crepes' }, select: { id: true } });

      const res = await request(app.getHttpServer())
        .get(`/recipes/${recipe.id}`)
        .set('Authorization', `Bearer ${marie.accessToken}`)
        .expect(200);

      expect(Object.keys(res.body).sort()).toEqual(
        ['cookMinutes', 'id', 'ingredients', 'prepMinutes', 'servings', 'steps', 'summary', 'title', 'vegetarian'].sort(),
      );
      expect(res.body.title).toBe('Crêpes');
      expect(res.body.ingredients[0]).toEqual({ name: 'Farine', quantity: '250 g', optional: false, staple: true });
      expect(res.body.steps.length).toBeGreaterThan(0);
    });

    it('answers 404 for an unknown recipe, 400 for a malformed id, 401 without token', async () => {
      const get = (id: string) =>
        request(app.getHttpServer()).get(`/recipes/${id}`).set('Authorization', `Bearer ${marie.accessToken}`);
      await get(randomUUID()).expect(404);
      await get('crepes').expect(400);
      await request(app.getHttpServer()).get(`/recipes/${randomUUID()}`).expect(401);
    });
  });

  describe('Ingredient recognition of pantry items', () => {
    const ingredientOf = async (itemId: string) =>
      (await prisma.pantryItem.findUniqueOrThrow({ where: { id: itemId }, select: { ingredientKey: true } })).ingredientKey;

    it('recognizes the ingredient from the name, server side', async () => {
      const item = await addItem(marie, { name: 'Pommes de terre', expiryDate: inDays(10) });
      expect(await ingredientOf(item.body.id)).toBe('potato');
    });

    it('prefers the categories of the scanned product over the name', async () => {
      const product = await prisma.product.create({
        data: { barcode: '3033490004743', name: 'Danone Nature', categories: ['en:dairies', 'en:yogurts'] },
      });
      const item = await addItem(marie, { name: 'Danone Nature', productId: product.id, expiryDate: inDays(10) });
      expect(await ingredientOf(item.body.id)).toBe('yogurt');
    });

    it('recognizes it again when the name changes', async () => {
      const item = await addItem(marie, { name: 'Truc', expiryDate: inDays(10) });
      expect(await ingredientOf(item.body.id)).toBeNull();

      await request(app.getHttpServer())
        .patch(`/pantry-items/${item.body.id}`)
        .set('Authorization', `Bearer ${marie.accessToken}`)
        .send({ name: 'Courgettes' })
        .expect(200);
      expect(await ingredientOf(item.body.id)).toBe('zucchini');
    });

    it('refuses an ingredient sent by the client (computed server side only)', async () => {
      await request(app.getHttpServer())
        .post(`/households/${marie.householdId}/pantry-items`)
        .set('Authorization', `Bearer ${marie.accessToken}`)
        .send({ name: 'Truc', expiryDate: inDays(10), expiryType: 'DLC', ingredientKey: 'egg' })
        .expect(400);
    });

    it("cannot rename another household's item (no recognition leak)", async () => {
      const item = await addItem(marie, { name: 'Œufs', expiryDate: inDays(10) });
      await request(app.getHttpServer())
        .patch(`/pantry-items/${item.body.id}`)
        .set('Authorization', `Bearer ${paul.accessToken}`)
        .send({ name: 'Courgettes' })
        .expect(404);
      expect(await ingredientOf(item.body.id)).toBe('egg');
    });
  });

  describe('Catalog synchronization', () => {
    it('does nothing when the catalog has not changed, and repairs the database when it has', async () => {
      const sync = app.get(RecipeCatalogSync);
      expect(await sync.sync()).toBe(false);

      // Base modifiée hors du code : la synchronisation suivante remet le catalogue en ordre.
      const item = await addItem(marie, { name: 'Œufs', expiryDate: inDays(10) });
      await prisma.pantryItem.update({ where: { id: item.body.id }, data: { ingredientKey: null } });
      await prisma.recipe.update({ where: { slug: 'crepes' }, data: { title: 'Modifiée' } });
      await prisma.catalogVersion.update({ where: { name: 'recipes' }, data: { hash: '0'.repeat(64) } });

      expect(await sync.sync()).toBe(true);
      expect((await prisma.recipe.findUniqueOrThrow({ where: { slug: 'crepes' } })).title).toBe('Crêpes');
      expect(
        (await prisma.pantryItem.findUniqueOrThrow({ where: { id: item.body.id }, select: { ingredientKey: true } }))
          .ingredientKey,
      ).toBe('egg');
    });
  });
});
