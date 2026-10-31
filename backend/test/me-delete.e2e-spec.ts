import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TEST_PASSWORD } from './setup/test-users.js';
import { TERMS_VERSION } from '../src/users/terms.js';

const OWNER = 'marie@example.com';
const OTHER = 'paul@example.com';

describe('DELETE /me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await app.close();
  });

  // Compte avec un article, une alerte et une session (cookie de refresh).
  async function createAccount(email: string) {
    const server = app.getHttpServer();
    await request(server).post('/auth/register').send({ termsVersion: TERMS_VERSION, email, password: TEST_PASSWORD }).expect(201);
    const login = await request(server).post('/auth/login').send({ email, password: TEST_PASSWORD }).expect(200);
    const accessToken: string = login.body.accessToken;
    const cookie = ([] as string[]).concat(login.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='))!;
    const me = await request(server).get('/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    const householdId: string = me.body.households[0].id;

    await request(server)
      .post(`/households/${householdId}/pantry-items`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Yaourts', quantity: 4, unit: 'PIECE', expiryDate: '2030-01-01', expiryType: 'DLC' })
      .expect(201);
    await prisma.alert.create({ data: { householdId, date: new Date('2030-01-01'), expiredCount: 0, urgentCount: 1 } });

    return { accessToken, cookie, householdId, userId: me.body.id as string };
  }

  const deleteMe = (accessToken: string | undefined, body: object) => {
    const req = request(app.getHttpServer()).delete('/me').send(body);
    return accessToken ? req.set('Authorization', `Bearer ${accessToken}`) : req;
  };

  it('requires an access token', async () => {
    await deleteMe(undefined, { password: TEST_PASSWORD }).expect(401);
  });

  it('refuses a wrong password with 403 (not 401) and keeps the account', async () => {
    const owner = await createAccount(OWNER);

    await deleteMe(owner.accessToken, { password: 'not the right password' }).expect(403);

    expect(await prisma.user.count({ where: { id: owner.userId } })).toBe(1);
    expect(await prisma.pantryItem.count({ where: { householdId: owner.householdId } })).toBe(1);
  });

  it.each([
    ['a missing password', {}],
    ['an empty password', { password: '' }],
    ['an overlong password', { password: 'x'.repeat(129) }],
    ['an unknown field', { password: TEST_PASSWORD, userId: 'someone-else' }],
  ])('rejects %s with 400', async (_case, body) => {
    const owner = await createAccount(OWNER);
    await deleteMe(owner.accessToken, body).expect(400);
    expect(await prisma.user.count({ where: { id: owner.userId } })).toBe(1);
  });

  it('erases the account and everything linked to it', async () => {
    const owner = await createAccount(OWNER);

    const res = await deleteMe(owner.accessToken, { password: TEST_PASSWORD }).expect(204);

    // Le cookie de session est effacé côté navigateur.
    const cleared = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='));
    expect(cleared).toMatch(/^refresh_token=;/);
    expect(cleared).toContain('Path=/auth');

    // Plus aucune trace en base : ni compte, ni foyer orphelin, ni inventaire, ni alerte, ni session.
    expect(await prisma.user.count({ where: { id: owner.userId } })).toBe(0);
    expect(await prisma.household.count({ where: { id: owner.householdId } })).toBe(0);
    expect(await prisma.householdMember.count({ where: { userId: owner.userId } })).toBe(0);
    expect(await prisma.pantryItem.count({ where: { householdId: owner.householdId } })).toBe(0);
    expect(await prisma.alert.count({ where: { householdId: owner.householdId } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: owner.userId } })).toBe(0);
  });

  it('leaves no way back in: old access token, old session cookie, password', async () => {
    const owner = await createAccount(OWNER);
    await deleteMe(owner.accessToken, { password: TEST_PASSWORD }).expect(204);
    const server = app.getHttpServer();

    await request(server).get('/me').set('Authorization', `Bearer ${owner.accessToken}`).expect(401);
    await request(server).post('/auth/refresh').set('Cookie', owner.cookie).expect(401);
    await request(server).post('/auth/login').send({ email: OWNER, password: TEST_PASSWORD }).expect(401);
  });

  it("does not touch another account's data", async () => {
    const owner = await createAccount(OWNER);
    const other = await createAccount(OTHER);

    await deleteMe(owner.accessToken, { password: TEST_PASSWORD }).expect(204);

    expect(await prisma.user.count({ where: { id: other.userId } })).toBe(1);
    expect(await prisma.pantryItem.count({ where: { householdId: other.householdId } })).toBe(1);
    expect(await prisma.alert.count({ where: { householdId: other.householdId } })).toBe(1);
    await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${other.accessToken}`).expect(200);
  });

  it('keeps a shared household for its other members', async () => {
    const owner = await createAccount(OWNER);
    const other = await createAccount(OTHER);
    // Foyer partagé (V2) : simulé directement en base.
    await prisma.householdMember.create({ data: { userId: other.userId, householdId: owner.householdId } });

    await deleteMe(owner.accessToken, { password: TEST_PASSWORD }).expect(204);

    expect(await prisma.household.count({ where: { id: owner.householdId } })).toBe(1);
    expect(await prisma.pantryItem.count({ where: { householdId: owner.householdId } })).toBe(1);
  });
});
