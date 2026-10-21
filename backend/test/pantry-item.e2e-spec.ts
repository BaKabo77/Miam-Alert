import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

describe('Single pantry item: read, update, delete (e2e)', () => {
  let app: INestApplication<App>;
  let marie: TestUser;
  let itemId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await resetDatabase(app.get(PrismaService));
    marie = await createTestUser(app, 'marie@example.com');

    const created = await request(app.getHttpServer())
      .post(`/households/${marie.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${marie.accessToken}`)
      .send({ name: 'Lait', quantity: 2, expiryDate: '2030-01-01', expiryType: 'DLC' })
      .expect(201);
    itemId = created.body.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const asMarie = () => {
    const server = app.getHttpServer();
    const auth = `Bearer ${marie.accessToken}`;
    return {
      get: (id = itemId) => request(server).get(`/pantry-items/${id}`).set('Authorization', auth),
      patch: (body: object, id = itemId) =>
        request(server).patch(`/pantry-items/${id}`).set('Authorization', auth).send(body),
      delete: (id = itemId) => request(server).delete(`/pantry-items/${id}`).set('Authorization', auth),
    };
  };

  it('reads an item', async () => {
    const res = await asMarie().get().expect(200);

    expect(res.body).toMatchObject({ id: itemId, name: 'Lait', quantity: 2, status: 'ACTIVE' });
  });

  it('updates only the fields that are sent', async () => {
    const res = await asMarie().patch({ quantity: 1 }).expect(200);

    expect(res.body).toMatchObject({ name: 'Lait', quantity: 1, expiryDate: '2030-01-01' });
  });

  it('marks an item as consumed, which removes it from the active inventory', async () => {
    await asMarie().patch({ status: 'CONSUMED' }).expect(200);

    const active = await request(app.getHttpServer())
      .get(`/households/${marie.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${marie.accessToken}`)
      .expect(200);
    expect(active.body.total).toBe(0);
  });

  it('deletes an item', async () => {
    await asMarie().delete().expect(204);

    await asMarie().get().expect(404);
  });

  it.each([
    ['a move to another household', { householdId: '00000000-0000-4000-8000-000000000000' }],
    ['a null name', { name: null }],
    ['a negative quantity', { quantity: -1 }],
    ['an unknown status', { status: 'EATEN' }],
    ['a date that does not exist', { expiryDate: '2026-13-01' }],
  ])('rejects %s', async (_label, body) => {
    await asMarie().patch(body).expect(400);
  });

  it('returns 404 for an item that does not exist', async () => {
    await asMarie().get('00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('rejects a malformed item id', async () => {
    await asMarie().get('42').expect(400);
  });
});
