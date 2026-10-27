import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  OpenFoodFactsClient,
  OpenFoodFactsUnavailableError,
} from '../src/products/open-food-facts.client.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

const NUTELLA = '3017620422003';

// Faux client Open Food Facts : les tests ne dépendent jamais d'un service extérieur
// (et la CI ne fait aucun appel réseau sortant).
const fakeOpenFoodFacts = { fetchProduct: vi.fn() };

describe('GET /products/:barcode (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let marie: TestUser;

  beforeEach(async () => {
    fakeOpenFoodFacts.fetchProduct.mockReset();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenFoodFactsClient)
      .useValue(fakeOpenFoodFacts)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    marie = await createTestUser(app, 'marie@example.com');
  });

  afterEach(async () => {
    await app.close();
  });

  const lookup = (barcode: string, token: string | undefined = marie.accessToken) => {
    const req = request(app.getHttpServer()).get(`/products/${barcode}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('requires an access token', async () => {
    await lookup(NUTELLA, '').expect(401);
  });

  it('fetches an unknown product from Open Food Facts and caches it', async () => {
    fakeOpenFoodFacts.fetchProduct.mockResolvedValue({
      barcode: NUTELLA,
      name: 'Nutella',
      brand: 'Ferrero',
      imageUrl: null,
      category: 'en:spreads',
      categories: ['en:spreads'],
      nutriscore: 'E',
    });

    const first = await lookup(NUTELLA).expect(200);
    const second = await lookup(NUTELLA).expect(200);

    expect(first.body).toMatchObject({ barcode: NUTELLA, name: 'Nutella', nutriscore: 'E' });
    // Date suggérée calculée côté serveur ; la liste brute des catégories reste interne.
    expect(first.body.suggestedExpiry).toEqual({ days: 180, expiryType: 'DDM' });
    expect(first.body).not.toHaveProperty('categories');
    expect(second.body).toEqual(first.body);
    // Le second appel est servi par le cache : Open Food Facts n'est appelé qu'une fois.
    expect(fakeOpenFoodFacts.fetchProduct).toHaveBeenCalledTimes(1);
    expect(await prisma.product.count({ where: { barcode: NUTELLA } })).toBe(1);
  });

  it.each([
    ['a wrong check digit', '3017620422004'],
    ['letters', 'abcdefghijklm'],
    ['a path traversal attempt', '..%2F..%2Fadmin'],
  ])('rejects %s without calling Open Food Facts', async (_label, barcode) => {
    await lookup(barcode).expect(400);

    expect(fakeOpenFoodFacts.fetchProduct).not.toHaveBeenCalled();
  });

  it('returns 404 for a product unknown to Open Food Facts, without caching it', async () => {
    fakeOpenFoodFacts.fetchProduct.mockResolvedValue(null);

    await lookup(NUTELLA).expect(404);

    expect(await prisma.product.count()).toBe(0);
  });

  it('returns 503 without details when Open Food Facts is unavailable', async () => {
    fakeOpenFoodFacts.fetchProduct.mockRejectedValue(
      new OpenFoodFactsUnavailableError('Unexpected status 502'),
    );

    const res = await lookup(NUTELLA).expect(503);

    expect(JSON.stringify(res.body)).not.toContain('502');
  });
});
