import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { todayUtc } from '../src/pantry/dates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Alerts API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let marie: TestUser;
  let paul: TestUser;
  let mariesAlertId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    marie = await createTestUser(app, 'marie@example.com');
    paul = await createTestUser(app, 'paul@example.com');

    const alert = await prisma.alert.create({
      data: { householdId: marie.householdId, date: todayUtc(), expiredCount: 1, urgentCount: 2 },
    });
    mariesAlertId = alert.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const as = (user: TestUser) => {
    const server = app.getHttpServer();
    const auth = `Bearer ${user.accessToken}`;
    return {
      today: (householdId = user.householdId) =>
        request(server).get(`/households/${householdId}/alerts/today`).set('Authorization', auth),
      read: (alertId: string) => request(server).post(`/alerts/${alertId}/read`).set('Authorization', auth),
    };
  };

  describe("today's alert", () => {
    it("returns the household's alert of the day, without internal fields", async () => {
      const res = await as(marie).today().expect(200);

      expect(res.body).toEqual({
        alert: {
          id: mariesAlertId,
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          expiredCount: 1,
          urgentCount: 2,
          read: false,
        },
      });
    });

    it('returns null when there is no alert today', async () => {
      await as(paul).today().expect(200).expect({ alert: null });
    });

    it("ignores yesterday's alert", async () => {
      const yesterday = new Date(todayUtc().getTime() - 86_400_000);
      await prisma.alert.create({
        data: { householdId: paul.householdId, date: yesterday, expiredCount: 3, urgentCount: 0 },
      });

      await as(paul).today().expect(200).expect({ alert: null });
    });

    it('requires an access token', async () => {
      await request(app.getHttpServer()).get(`/households/${marie.householdId}/alerts/today`).expect(401);
    });

    it('rejects a malformed household id', async () => {
      await as(marie).today('not-a-uuid').expect(400);
    });
  });

  describe('mark as read', () => {
    it('marks the alert as read', async () => {
      await as(marie).read(mariesAlertId).expect(204);

      const res = await as(marie).today().expect(200);
      expect(res.body.alert.read).toBe(true);
    });

    it('is idempotent and keeps the first read date', async () => {
      await as(marie).read(mariesAlertId).expect(204);
      const firstRead = (await prisma.alert.findUniqueOrThrow({ where: { id: mariesAlertId } })).readAt;

      await as(marie).read(mariesAlertId).expect(204);

      const stored = await prisma.alert.findUniqueOrThrow({ where: { id: mariesAlertId } });
      expect(stored.readAt).toEqual(firstRead);
    });

    it('returns 404 for an alert that does not exist', async () => {
      await as(marie).read(UNKNOWN_ID).expect(404);
    });
  });

  // Paul est authentifié correctement, mais vise les données de Marie : attaque IDOR.
  describe("another household's alert (IDOR)", () => {
    it("cannot read another household's alert", async () => {
      const res = await as(paul).today(marie.householdId).expect(404);

      expect(JSON.stringify(res.body)).not.toContain(mariesAlertId);
    });

    it("cannot mark another household's alert as read", async () => {
      await as(paul).read(mariesAlertId).expect(404);

      const stored = await prisma.alert.findUniqueOrThrow({ where: { id: mariesAlertId } });
      expect(stored.readAt).toBeNull();
    });

    it('gets the same answer for a foreign alert and a non-existent one', async () => {
      const foreign = await as(paul).read(mariesAlertId).expect(404);
      const missing = await as(paul).read(UNKNOWN_ID).expect(404);

      expect(foreign.body).toEqual(missing.body);
    });
  });
});
