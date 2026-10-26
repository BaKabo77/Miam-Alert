import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AlertsService } from '../src/alerts/alerts.service.js';
import { AppModule } from '../src/app.module.js';
import { formatDateOnly, parseDateOnly, todayUtc } from '../src/pantry/dates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

const inDays = (days: number) => parseDateOnly(formatDateOnly(new Date(todayUtc().getTime() + days * 86_400_000)));

describe('Daily alerts generation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let alerts: AlertsService;
  let marie: TestUser;
  let paul: TestUser;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    alerts = app.get(AlertsService);
    await resetDatabase(prisma);

    marie = await createTestUser(app, 'marie@example.com');
    paul = await createTestUser(app, 'paul@example.com');

    const item = (householdId: string, days: number, extra: object = {}) => ({
      householdId,
      name: 'Produit',
      expiryDate: inDays(days),
      expiryType: 'DLC' as const,
      ...extra,
    });
    await prisma.pantryItem.createMany({
      data: [
        // Marie : 1 périmé, 2 urgents (dont une DDM dépassée), 1 OK, 1 consommé (ignoré).
        item(marie.householdId, -1),
        item(marie.householdId, 1),
        item(marie.householdId, -3, { expiryType: 'DDM' }),
        item(marie.householdId, 30),
        item(marie.householdId, -2, { status: 'CONSUMED' }),
        // Paul : rien d'urgent.
        item(paul.householdId, 10),
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates one grouped alert for each household that needs one', async () => {
    const created = await alerts.generateDailyAlerts();

    expect(created).toBe(1);
    const stored = await prisma.alert.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      householdId: marie.householdId,
      expiredCount: 1,
      urgentCount: 2,
      readAt: null,
    });
    expect(formatDateOnly(stored[0].date)).toBe(formatDateOnly(todayUtc()));
  });

  it('is idempotent: running twice the same day creates no duplicate', async () => {
    await alerts.generateDailyAlerts();
    const secondRun = await alerts.generateDailyAlerts();

    expect(secondRun).toBe(0);
    expect(await prisma.alert.count()).toBe(1);
  });

  it('runs concurrently without duplicates (several servers, retries)', async () => {
    await Promise.all([alerts.generateDailyAlerts(), alerts.generateDailyAlerts(), alerts.generateDailyAlerts()]);

    expect(await prisma.alert.count()).toBe(1);
  });

  it('is scheduled every day at 9:00, Paris time', () => {
    const job = app.get(SchedulerRegistry).getCronJob('daily-alerts');
    const next = job.nextDate().setZone('Europe/Paris');

    expect(next.hour).toBe(9);
    expect(next.minute).toBe(0);
  });
});
