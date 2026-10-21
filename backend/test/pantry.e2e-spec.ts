import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { formatDateOnly, todayUtc } from '../src/pantry/dates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

// Date relative à aujourd'hui, au format de l'API ("YYYY-MM-DD").
const inDays = (days: number) =>
  formatDateOnly(new Date(todayUtc().getTime() + days * 24 * 60 * 60 * 1000));

// Un foyer qui n'est pas celui de l'utilisateur, glissé dans le corps de la requête.
const OTHER_HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000000';

describe('Pantry items (e2e)', () => {
  let app: INestApplication<App>;
  let marie: TestUser;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await resetDatabase(app.get(PrismaService));
    marie = await createTestUser(app, 'marie@example.com');
  });

  afterEach(async () => {
    await app.close();
  });

  const itemsUrl = (householdId: string) => `/households/${householdId}/pantry-items`;

  const create = (body: object, user: TestUser = marie) =>
    request(app.getHttpServer())
      .post(itemsUrl(user.householdId))
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(body);

  const list = (query = '', user: TestUser = marie) =>
    request(app.getHttpServer())
      .get(`${itemsUrl(user.householdId)}${query}`)
      .set('Authorization', `Bearer ${user.accessToken}`);

  const validItem = { name: 'Yaourt nature', expiryDate: inDays(1), expiryType: 'DLC' };

  describe('create', () => {
    it('creates an item with defaults and computed urgency', async () => {
      const res = await create({ ...validItem, name: '  Yaourt nature  ' }).expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'Yaourt nature',
        quantity: 1,
        unit: 'PIECE',
        expiryDate: inDays(1),
        expiryType: 'DLC',
        status: 'ACTIVE',
        daysLeft: 1,
        urgency: 'URGENT',
      });
    });

    it('requires an access token', () => {
      return request(app.getHttpServer()).post(itemsUrl(marie.householdId)).send(validItem).expect(401);
    });

    it.each([
      ['an unknown field (mass assignment)', { ...validItem, householdId: OTHER_HOUSEHOLD_ID }],
      ['a status (always ACTIVE on creation)', { ...validItem, status: 'CONSUMED' }],
      ['a zero quantity', { ...validItem, quantity: 0 }],
      ['a null quantity', { ...validItem, quantity: null }],
      ['a decimal quantity', { ...validItem, quantity: 1.5 }],
      ['a blank name', { ...validItem, name: '   ' }],
      ['a name that is too long', { ...validItem, name: 'a'.repeat(201) }],
      ['a date in the wrong format', { ...validItem, expiryDate: '30/10/2026' }],
      ['a date that does not exist', { ...validItem, expiryDate: '2026-02-30' }],
      ['an unknown expiry type', { ...validItem, expiryType: 'BEST' }],
    ])('rejects %s', async (_label, body) => {
      await create(body).expect(400);
    });

    it('rejects a malformed household id', () => {
      return request(app.getHttpServer())
        .post(itemsUrl('not-a-uuid'))
        .set('Authorization', `Bearer ${marie.accessToken}`)
        .send(validItem)
        .expect(400);
    });
  });

  describe('list', () => {
    it('sorts by urgency: closest date first, DLC before DDM on the same day', async () => {
      await create({ name: 'Pâtes', expiryDate: inDays(200), expiryType: 'DDM' }).expect(201);
      await create({ name: 'Biscuits', expiryDate: inDays(1), expiryType: 'DDM' }).expect(201);
      await create({ name: 'Poulet', expiryDate: inDays(-1), expiryType: 'DLC' }).expect(201);
      await create({ name: 'Lait', expiryDate: inDays(1), expiryType: 'DLC' }).expect(201);

      const res = await list().expect(200);

      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual([
        'Poulet',
        'Lait',
        'Biscuits',
        'Pâtes',
      ]);
      expect(res.body.items.map((i: { urgency: string }) => i.urgency)).toEqual([
        'EXPIRED',
        'URGENT',
        'URGENT',
        'OK',
      ]);
    });

    it('paginates with a total count', async () => {
      for (let day = 1; day <= 5; day++) {
        await create({ ...validItem, name: `Item ${day}`, expiryDate: inDays(day) }).expect(201);
      }

      const res = await list('?page=2&pageSize=2').expect(200);

      expect(res.body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Item 3', 'Item 4']);
    });

    it.each([
      ['a page size above the maximum', '?pageSize=101'],
      ['a page that is not a number', '?page=abc'],
      ['an unknown status', '?status=EATEN'],
      ['an unknown query parameter', '?householdId=x'],
    ])('rejects %s', async (_label, query) => {
      await list(query).expect(400);
    });
  });
});
