import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

// Paul est authentifié correctement, mais il vise le foyer de Marie en changeant l'id
// dans l'URL : c'est l'attaque IDOR. Toutes ses tentatives doivent échouer.
describe('Pantry items: access to another household (IDOR, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let marie: TestUser;
  let paul: TestUser;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    marie = await createTestUser(app, 'marie@example.com');
    paul = await createTestUser(app, 'paul@example.com');

    await request(app.getHttpServer())
      .post(`/households/${marie.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${marie.accessToken}`)
      .send({ name: 'Lait', expiryDate: '2030-01-01', expiryType: 'DLC' })
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  const asPaul = () => ({
    get: (url: string) =>
      request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${paul.accessToken}`),
    post: (url: string) =>
      request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${paul.accessToken}`),
  });

  it("cannot list another household's items", async () => {
    const res = await asPaul().get(`/households/${marie.householdId}/pantry-items`).expect(404);

    expect(JSON.stringify(res.body)).not.toContain('Lait');
  });

  it('cannot add an item to another household', async () => {
    await asPaul()
      .post(`/households/${marie.householdId}/pantry-items`)
      .send({ name: 'Intrus', expiryDate: '2030-01-01', expiryType: 'DLC' })
      .expect(404);

    expect(await prisma.pantryItem.count({ where: { householdId: marie.householdId } })).toBe(1);
  });

  it('gets the same answer for a foreign household and a non-existent one', async () => {
    const foreign = await asPaul().get(`/households/${marie.householdId}/pantry-items`).expect(404);
    const missing = await asPaul()
      .get('/households/00000000-0000-4000-8000-000000000000/pantry-items')
      .expect(404);

    expect(foreign.body).toEqual(missing.body);
  });
});
