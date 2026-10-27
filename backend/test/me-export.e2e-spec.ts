import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TEST_PASSWORD, type TestUser } from './setup/test-users.js';

const OWNER = 'marie@example.com';
const OTHER = 'paul@example.com';

describe('GET /me/export (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: TestUser;
  let other: TestUser;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    owner = await createTestUser(app, OWNER);
    other = await createTestUser(app, OTHER);
    await addItem(owner, 'Yaourts nature');
    await addItem(other, 'Article de Paul');
    await prisma.alert.create({
      data: { householdId: owner.householdId, date: new Date('2030-01-01'), expiredCount: 1, urgentCount: 2 },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function addItem(user: TestUser, name: string) {
    return request(app.getHttpServer())
      .post(`/households/${user.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ name, quantity: 4, unit: 'PIECE', expiryDate: '2030-01-05', expiryType: 'DLC' })
      .expect(201);
  }

  const exportFor = (accessToken?: string) => {
    const req = request(app.getHttpServer()).get('/me/export');
    return accessToken ? req.set('Authorization', `Bearer ${accessToken}`) : req;
  };

  it('requires an access token', async () => {
    await exportFor().expect(401);
  });

  it("returns the account's data as a downloadable, non-cacheable file", async () => {
    const res = await exportFor(owner.accessToken).expect(200);

    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="miam-alert-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers['cache-control']).toBe('no-store');

    expect(res.body.account).toMatchObject({ email: OWNER, firstName: null, lastName: null });
    expect(res.body.households).toHaveLength(1);
    expect(res.body.households[0]).toMatchObject({ name: 'Mon foyer', role: 'OWNER' });
    expect(res.body.households[0].pantryItems).toEqual([
      expect.objectContaining({ name: 'Yaourts nature', quantity: 4, expiryDate: '2030-01-05', product: null }),
    ]);
    expect(res.body.households[0].alerts).toEqual([
      { date: '2030-01-01', expiredCount: 1, urgentCount: 2, readAt: null },
    ]);
    expect(res.body.sessions).toEqual([
      { startedAt: expect.any(String), lastRenewedAt: expect.any(String), expiresAt: expect.any(String), active: true },
    ]);
  });

  it('counts one session per login, not one per token renewal', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: OWNER, password: TEST_PASSWORD })
      .expect(200);
    const cookie = ([] as string[]).concat(login.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='))!;
    // Deux renouvellements de cette deuxième connexion : toujours une seule session pour elle.
    const renewed = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(200);
    const cookie2 = ([] as string[]).concat(renewed.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='))!;
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie2).expect(200);

    const res = await exportFor(owner.accessToken).expect(200);

    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.sessions.every((session: { active: boolean }) => session.active)).toBe(true);
  });

  it("never contains another account's data", async () => {
    const res = await exportFor(owner.accessToken).expect(200);
    const text = JSON.stringify(res.body);

    expect(text).not.toContain(OTHER);
    expect(text).not.toContain('Article de Paul');
    expect(text).not.toContain(other.householdId);
  });

  it('contains no secret nor internal identifier', async () => {
    const res = await exportFor(owner.accessToken).expect(200);
    const text = JSON.stringify(res.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: OWNER },
      select: { id: true, passwordHash: true, refreshTokens: { select: { tokenHash: true } } },
    });

    expect(text).not.toContain(user.passwordHash);
    expect(text).not.toContain(user.refreshTokens[0].tokenHash);
    expect(text).not.toContain(TEST_PASSWORD);
    expect(text).not.toContain(user.id);
    expect(text).not.toContain(owner.householdId);
    expect(text).not.toMatch(/passwordHash|tokenHash|familyId/);
  });

  it('is rate limited (5 per minute)', async () => {
    for (let i = 0; i < 5; i++) {
      await exportFor(owner.accessToken).expect(200);
    }
    await exportFor(owner.accessToken).expect(429);
  });
});
