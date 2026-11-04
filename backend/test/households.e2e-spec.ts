import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { MAX_ACTIVE_INVITATIONS, MAX_MEMBERS } from '../src/households/households.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TEST_PASSWORD, TestUser } from './setup/test-users.js';

// Foyer partagé. Marie est propriétaire (OWNER) de son foyer ; elle invite Paul, qui devient
// membre (MEMBER). Lucie, elle, n'est membre que de son propre foyer : c'est l'« autre foyer ».
describe('Shared household (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let marie: TestUser;
  let paul: TestUser;
  let lucie: TestUser;
  let paulId: string;
  let marieId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    marie = await createTestUser(app, 'marie@example.com');
    paul = await createTestUser(app, 'paul@example.com');
    lucie = await createTestUser(app, 'lucie@example.com');
    marieId = (await prisma.user.findUniqueOrThrow({ where: { email: 'marie@example.com' } })).id;
    paulId = (await prisma.user.findUniqueOrThrow({ where: { email: 'paul@example.com' } })).id;
  });

  afterEach(async () => {
    await app.close();
  });

  const as = (user: TestUser) => {
    const server = app.getHttpServer();
    const auth = `Bearer ${user.accessToken}`;
    return {
      get: (url: string) => request(server).get(url).set('Authorization', auth),
      post: (url: string, body: object = {}) => request(server).post(url).set('Authorization', auth).send(body),
      patch: (url: string, body: object) => request(server).patch(url).set('Authorization', auth).send(body),
      delete: (url: string, body?: object) => request(server).delete(url).set('Authorization', auth).send(body),
    };
  };

  const invite = async (owner: TestUser = marie, householdId = marie.householdId): Promise<string> => {
    const res = await as(owner).post(`/households/${householdId}/invitations`).expect(201);
    return new URL(res.body.url).hash.replace('#token=', '');
  };

  const join = async (user: TestUser, token: string) =>
    as(user).post('/household-invitations/accept', { token }).expect(200);

  describe('invitation flow', () => {
    it('lets an invited user preview, then join the household as a member', async () => {
      const created = await as(marie).post(`/households/${marie.householdId}/invitations`).expect(201);
      expect(created.body.url).toMatch(/^http:\/\/localhost:5173\/join#token=[A-Za-z0-9_-]{43}$/);
      expect(Object.keys(created.body).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'url']);
      const token = new URL(created.body.url).hash.replace('#token=', '');

      const preview = await as(paul).post('/household-invitations/preview', { token }).expect(200);
      expect(preview.body).toEqual({ householdName: 'Mon foyer', invitedBy: null, alreadyMember: false });

      const accepted = await join(paul, token);
      expect(accepted.body).toEqual({ householdId: marie.householdId });

      const household = await as(paul).get(`/households/${marie.householdId}`).expect(200);
      expect(household.body.role).toBe('MEMBER');
      expect(household.body.members).toEqual([
        { userId: marieId, displayName: 'marie@example.com', role: 'OWNER', joinedAt: expect.any(String), isMe: false },
        { userId: paulId, displayName: 'paul@example.com', role: 'MEMBER', joinedAt: expect.any(String), isMe: true },
      ]);

      // Paul garde son propre foyer, en premier ; celui de Marie s'ajoute.
      const me = await as(paul).get('/me').expect(200);
      expect(me.body.households.map((h: { id: string }) => h.id)).toEqual([paul.householdId, marie.householdId]);
      // Deux foyers « Mon foyer » : le propriétaire permet de les distinguer.
      expect(me.body.households[1]).toMatchObject({ name: 'Mon foyer', role: 'MEMBER', ownerName: 'marie@example.com' });
    });

    it('shows the inviter first name only, and members by name rather than email', async () => {
      await as(marie).patch('/me', { firstName: 'Marie', lastName: 'Curie' }).expect(200);
      const token = await invite();

      const preview = await as(paul).post('/household-invitations/preview', { token }).expect(200);
      expect(preview.body.invitedBy).toBe('Marie');

      await join(paul, token);
      const household = await as(paul).get(`/households/${marie.householdId}`).expect(200);
      expect(household.body.members[0].displayName).toBe('Marie Curie');
    });

    it('shares the inventory between members', async () => {
      await join(paul, await invite());

      await as(paul)
        .post(`/households/${marie.householdId}/pantry-items`, { name: 'Lait', expiryDate: '2030-01-01', expiryType: 'DLC' })
        .expect(201);
      const list = await as(marie).get(`/households/${marie.householdId}/pantry-items`).expect(200);
      expect(list.body.items.map((item: { name: string }) => item.name)).toEqual(['Lait']);
    });

    it('never returns the link again after its creation', async () => {
      await invite();
      const list = await as(marie).get(`/households/${marie.householdId}/invitations`).expect(200);
      expect(list.body).toHaveLength(1);
      expect(Object.keys(list.body[0]).sort()).toEqual(['createdAt', 'expiresAt', 'id']);
    });

    it('stores only a hash of the link', async () => {
      const token = await invite();
      const stored = await prisma.householdInvitation.findFirstOrThrow({ select: { tokenHash: true } });
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.tokenHash).not.toContain(token);
    });
  });

  describe('invalid links', () => {
    it('accepts a link only once', async () => {
      const token = await invite();
      await join(paul, token);

      const again = await as(lucie).post('/household-invitations/accept', { token }).expect(400);
      expect(again.body.message).toBe('Invalid or expired invitation');
      await as(lucie).post('/household-invitations/preview', { token }).expect(400);
    });

    it('refuses an unknown, malformed or expired link with the same answer', async () => {
      const unknown = await as(paul)
        .post('/household-invitations/accept', { token: randomBytes(32).toString('base64url') })
        .expect(400);
      expect(unknown.body.message).toBe('Invalid or expired invitation');

      await as(paul).post('/household-invitations/accept', { token: 'not-a-token' }).expect(400);
      await as(paul).post('/household-invitations/accept', { token: randomBytes(32).toString('base64url'), extra: 1 }).expect(400);

      const token = await invite();
      await prisma.householdInvitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      const expired = await as(paul).post('/household-invitations/accept', { token }).expect(400);
      expect(expired.body.message).toBe('Invalid or expired invitation');
      expect(await prisma.householdMember.count({ where: { householdId: marie.householdId } })).toBe(1);
    });

    it('does not consume the link when the user is already a member', async () => {
      const token = await invite();
      const preview = await as(marie).post('/household-invitations/preview', { token }).expect(200);
      expect(preview.body.alreadyMember).toBe(true);

      await as(marie).post('/household-invitations/accept', { token }).expect(409);
      await join(paul, token);
    });

    it('lets only one of two simultaneous acceptances of the same link succeed', async () => {
      const token = await invite();
      const results = await Promise.all([
        as(paul).post('/household-invitations/accept', { token }),
        as(lucie).post('/household-invitations/accept', { token }),
      ]);
      expect(results.map((res) => res.status).sort((a, b) => a - b)).toEqual([200, 400]);
      expect(await prisma.householdMember.count({ where: { householdId: marie.householdId } })).toBe(2);
    });

    it('requires a valid access token', async () => {
      const token = await invite();
      await request(app.getHttpServer()).post('/household-invitations/accept').send({ token }).expect(401);
      await request(app.getHttpServer()).post('/household-invitations/preview').send({ token }).expect(401);
    });
  });

  describe('owner-only actions', () => {
    beforeEach(async () => {
      await join(paul, await invite());
    });

    it('are refused to a member (403)', async () => {
      const url = `/households/${marie.householdId}`;
      const invitation = await as(marie).post(`${url}/invitations`).expect(201);

      await as(paul).patch(url, { name: 'Chez Paul' }).expect(403);
      await as(paul).post(`${url}/invitations`).expect(403);
      await as(paul).get(`${url}/invitations`).expect(403);
      await as(paul).delete(`${url}/invitations/${invitation.body.id}`).expect(403);
      await as(paul).post(`${url}/ownership`, { userId: paulId }).expect(403);
      await as(paul).delete(`${url}/members/${marieId}`).expect(403);

      const household = await as(marie).get(url).expect(200);
      expect(household.body.name).toBe('Mon foyer');
      expect(household.body.role).toBe('OWNER');
    });

    it('let the owner rename the household, with a validated name', async () => {
      const url = `/households/${marie.householdId}`;
      const renamed = await as(marie).patch(url, { name: '  Coloc  du 12  ' }).expect(200);
      expect(renamed.body.name).toBe('Coloc du 12');

      await as(marie).patch(url, { name: '<script>' }).expect(400);
      await as(marie).patch(url, { name: '' }).expect(400);
      await as(marie).patch(url, { name: 'a'.repeat(101) }).expect(400);
      await as(marie).patch(url, { name: 'Ok', id: randomUUID() }).expect(400);
    });

    it('let the owner remove a member, who then loses all access', async () => {
      const created = await as(marie)
        .post(`/households/${marie.householdId}/pantry-items`, { name: 'Riz', expiryDate: '2030-01-01', expiryType: 'DDM' })
        .expect(201);

      await as(marie).delete(`/households/${marie.householdId}/members/${paulId}`).expect(204);

      await as(paul).get(`/households/${marie.householdId}`).expect(404);
      await as(paul).get(`/households/${marie.householdId}/pantry-items`).expect(404);
      await as(paul).get(`/pantry-items/${created.body.id}`).expect(404);
      await as(marie).delete(`/households/${marie.householdId}/members/${paulId}`).expect(404);
    });

    it('let the owner revoke an invitation of their household only', async () => {
      const own = await as(marie).post(`/households/${marie.householdId}/invitations`).expect(201);
      const lucies = await as(lucie).post(`/households/${lucie.householdId}/invitations`).expect(201);

      // L'invitation de Lucie, visée depuis le foyer de Marie : introuvable.
      await as(marie).delete(`/households/${marie.householdId}/invitations/${lucies.body.id}`).expect(404);
      await as(marie).delete(`/households/${marie.householdId}/invitations/${own.body.id}`).expect(204);

      const token = new URL(own.body.url).hash.replace('#token=', '');
      await as(lucie).post('/household-invitations/accept', { token }).expect(400);
      const lucieToken = new URL(lucies.body.url).hash.replace('#token=', '');
      await join(paul, lucieToken);
    });

    it('let the owner transfer ownership, keeping exactly one owner', async () => {
      const url = `/households/${marie.householdId}`;
      await as(marie).post(`${url}/ownership`, { userId: marieId }).expect(400);
      await as(marie).post(`${url}/ownership`, { userId: randomUUID() }).expect(404);
      expect((await as(marie).get(url).expect(200)).body.role).toBe('OWNER');

      const transferred = await as(marie).post(`${url}/ownership`, { userId: paulId }).expect(200);
      expect(transferred.body.role).toBe('MEMBER');
      expect(await prisma.householdMember.count({ where: { householdId: marie.householdId, role: 'OWNER' } })).toBe(1);

      await as(marie).post(`${url}/invitations`).expect(403);
      await as(paul).post(`${url}/invitations`).expect(201);
    });
  });

  describe('leaving a household', () => {
    it('lets a member leave', async () => {
      await join(paul, await invite());
      await as(paul).delete(`/households/${marie.householdId}/members/${paulId}`).expect(204);
      await as(paul).get(`/households/${marie.householdId}`).expect(404);
    });

    it('refuses the owner leaving while other members remain', async () => {
      await join(paul, await invite());
      const res = await as(marie).delete(`/households/${marie.householdId}/members/${marieId}`).expect(409);
      expect(res.body.message).toBe('Transfer ownership before leaving the household');
    });

    it('refuses the last member leaving', async () => {
      await as(marie).delete(`/households/${marie.householdId}/members/${marieId}`).expect(409);
    });

    it("gives a new empty household to a member who leaves their only household", async () => {
      await join(paul, await invite());
      // Paul n'appartient plus qu'au foyer de Marie (il a transmis le sien, puis l'a quitté...).
      await prisma.household.delete({ where: { id: paul.householdId } });

      await as(paul).delete(`/households/${marie.householdId}/members/${paulId}`).expect(204);

      const me = await as(paul).get('/me').expect(200);
      expect(me.body.households).toHaveLength(1);
      expect(me.body.households[0]).toMatchObject({ name: 'Mon foyer', role: 'OWNER' });
      expect(me.body.households[0].id).not.toBe(marie.householdId);
      const items = await as(paul).get(`/households/${me.body.households[0].id}/pantry-items`).expect(200);
      expect(items.body.items).toEqual([]);
    });

    it('gives a new empty household to a member removed from their only household', async () => {
      await join(paul, await invite());
      await prisma.household.delete({ where: { id: paul.householdId } });

      await as(marie).delete(`/households/${marie.householdId}/members/${paulId}`).expect(204);

      const me = await as(paul).get('/me').expect(200);
      expect(me.body.households).toHaveLength(1);
      expect(me.body.households[0].role).toBe('OWNER');
    });

    it('lets a former owner leave after transferring their only household', async () => {
      await join(paul, await invite());
      await as(marie).post(`/households/${marie.householdId}/ownership`, { userId: paulId }).expect(200);

      await as(marie).delete(`/households/${marie.householdId}/members/${marieId}`).expect(204);

      const me = await as(marie).get('/me').expect(200);
      expect(me.body.households).toHaveLength(1);
      expect(me.body.households[0].id).not.toBe(marie.householdId);
      const household = await as(paul).get(`/households/${marie.householdId}`).expect(200);
      expect(household.body.role).toBe('OWNER');
      expect(household.body.members).toHaveLength(1);
    });
  });

  describe('access to another household (IDOR)', () => {
    it('answers 404 to a non-member, exactly as for a household that does not exist', async () => {
      for (const householdId of [marie.householdId, randomUUID()]) {
        const url = `/households/${householdId}`;
        await as(lucie).get(url).expect(404);
        await as(lucie).patch(url, { name: 'Pris' }).expect(404);
        await as(lucie).post(`${url}/invitations`).expect(404);
        await as(lucie).get(`${url}/invitations`).expect(404);
        await as(lucie).delete(`${url}/invitations/${randomUUID()}`).expect(404);
        await as(lucie).post(`${url}/ownership`, { userId: marieId }).expect(404);
        await as(lucie).delete(`${url}/members/${marieId}`).expect(404);
      }

      const household = await as(marie).get(`/households/${marie.householdId}`).expect(200);
      expect(household.body.name).toBe('Mon foyer');
      expect(household.body.members).toHaveLength(1);
    });

    it('rejects a malformed household id before any access check', async () => {
      await as(marie).get('/households/not-a-uuid').expect(400);
      await as(marie).post('/households/not-a-uuid/invitations').expect(400);
    });
  });

  describe('limits', () => {
    it(`allows at most ${MAX_ACTIVE_INVITATIONS} active invitations`, async () => {
      for (let i = 0; i < MAX_ACTIVE_INVITATIONS; i++) {
        await invite();
      }
      const res = await as(marie).post(`/households/${marie.householdId}/invitations`).expect(409);
      expect(res.body.message).toBe('Too many active invitations');
    });

    it(`allows at most ${MAX_MEMBERS} members`, async () => {
      const token = await invite();
      for (let i = 0; i < MAX_MEMBERS - 1; i++) {
        await prisma.user.create({
          data: {
            email: `member${i}@example.com`,
            passwordHash: 'not-a-real-hash',
            memberships: { create: { householdId: marie.householdId, role: 'MEMBER' } },
          },
        });
      }

      const accepted = await as(paul).post('/household-invitations/accept', { token }).expect(409);
      expect(accepted.body.message).toBe('Household is full');
      await as(marie).post(`/households/${marie.householdId}/invitations`).expect(409);
    });
  });

  describe('account deletion', () => {
    it("hands a shared household over to its oldest member when the owner deletes their account", async () => {
      await join(paul, await invite());
      await as(lucie).post('/household-invitations/accept', { token: await invite() }).expect(200);
      await as(marie)
        .post(`/households/${marie.householdId}/pantry-items`, { name: 'Pâtes', expiryDate: '2030-01-01', expiryType: 'DDM' })
        .expect(201);

      await as(marie).delete('/me', { password: TEST_PASSWORD }).expect(204);

      const household = await as(paul).get(`/households/${marie.householdId}`).expect(200);
      expect(household.body.role).toBe('OWNER');
      expect(household.body.members.map((m: { userId: string }) => m.userId)).not.toContain(marieId);
      const items = await as(paul).get(`/households/${marie.householdId}/pantry-items`).expect(200);
      expect(items.body.items).toHaveLength(1);
      expect(await prisma.householdMember.count({ where: { householdId: marie.householdId, role: 'OWNER' } })).toBe(1);
    });
  });
});
