import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

// Paul est authentifié correctement, mais il vise les données de Marie en changeant un id
// dans l'URL : c'est l'attaque IDOR. Toutes ses tentatives doivent échouer.
describe('Pantry items: access to another household (IDOR, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let marie: TestUser;
  let paul: TestUser;
  let mariesItemId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    marie = await createTestUser(app, 'marie@example.com');
    paul = await createTestUser(app, 'paul@example.com');

    const created = await request(app.getHttpServer())
      .post(`/households/${marie.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${marie.accessToken}`)
      .send({ name: 'Lait', expiryDate: '2030-01-01', expiryType: 'DLC' })
      .expect(201);
    mariesItemId = created.body.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const asPaul = () => {
    const server = app.getHttpServer();
    const auth = `Bearer ${paul.accessToken}`;
    return {
      get: (url: string) => request(server).get(url).set('Authorization', auth),
      post: (url: string) => request(server).post(url).set('Authorization', auth),
      patch: (url: string) => request(server).patch(url).set('Authorization', auth),
      delete: (url: string) => request(server).delete(url).set('Authorization', auth),
    };
  };

  // L'article de Marie, relu directement en base pour vérifier qu'il n'a pas bougé.
  const mariesItem = () => prisma.pantryItem.findUnique({ where: { id: mariesItemId } });

  describe("Marie's household", () => {
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

  describe("Marie's item", () => {
    it('cannot read it', async () => {
      const res = await asPaul().get(`/pantry-items/${mariesItemId}`).expect(404);

      expect(JSON.stringify(res.body)).not.toContain('Lait');
    });

    it('cannot update it', async () => {
      await asPaul()
        .patch(`/pantry-items/${mariesItemId}`)
        .send({ name: 'Piraté', status: 'WASTED' })
        .expect(404);

      expect(await mariesItem()).toMatchObject({ name: 'Lait', status: 'ACTIVE' });
    });

    it('cannot delete it', async () => {
      await asPaul().delete(`/pantry-items/${mariesItemId}`).expect(404);

      expect(await mariesItem()).not.toBeNull();
    });

    it('gets the same answer for a foreign item and a non-existent one', async () => {
      const foreign = await asPaul().get(`/pantry-items/${mariesItemId}`).expect(404);
      const missing = await asPaul().get('/pantry-items/00000000-0000-4000-8000-000000000000').expect(404);

      expect(foreign.body).toEqual(missing.body);
    });
  });
});
