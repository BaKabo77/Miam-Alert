import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PurgeService } from '../src/maintenance/purge.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';

const NOW = new Date('2027-03-01T03:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const hash = () => randomBytes(32).toString('hex');

describe('Nightly data purge (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let householdId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const user = await prisma.user.create({
      data: {
        email: 'marie@example.com',
        passwordHash: 'not-a-real-hash',
        memberships: { create: { role: 'OWNER', household: { create: { name: 'Mon foyer' } } } },
      },
      select: { id: true, memberships: { select: { householdId: true } } },
    });
    userId = user.id;
    householdId = user.memberships[0].householdId;
  });

  afterEach(async () => {
    await app.close();
  });

  const session = (expiresAt: Date, revokedAt: Date | null = null) =>
    prisma.refreshToken.create({
      data: { userId, familyId: randomUUID(), tokenHash: hash(), expiresAt, revokedAt },
      select: { id: true },
    });
  const emailToken = (expiresAt: Date, usedAt: Date | null) =>
    prisma.emailToken.create({
      data: { userId, purpose: 'PASSWORD_RESET', tokenHash: hash(), expiresAt, usedAt },
      select: { id: true },
    });
  const alert = (date: Date) =>
    prisma.alert.create({ data: { householdId, date, expiredCount: 1, urgentCount: 0 }, select: { id: true } });

  it('deletes sessions only 30 days after they expired', async () => {
    const old = await session(daysAgo(31));
    const recent = await session(daysAgo(29));
    const active = await session(daysAgo(-3));
    // Révoquée mais pas encore expirée : doit rester, pour que sa réutilisation soit détectée comme un vol.
    const revoked = await session(daysAgo(-3), daysAgo(1));

    const result = await app.get(PurgeService).purgeExpiredData(NOW);

    expect(result.sessions).toBe(1);
    const remaining = (await prisma.refreshToken.findMany({ select: { id: true } })).map(({ id }) => id);
    expect(remaining.sort()).toEqual([recent.id, active.id, revoked.id].sort());
    expect(remaining).not.toContain(old.id);
  });

  it('deletes email links only 30 days after they were used or expired', async () => {
    const usedLongAgo = await emailToken(daysAgo(40), daysAgo(31));
    const usedRecently = await emailToken(daysAgo(28), daysAgo(29));
    const expiredLongAgo = await emailToken(daysAgo(31), null);
    const stillValid = await emailToken(daysAgo(-1), null);

    const result = await app.get(PurgeService).purgeExpiredData(NOW);

    expect(result.emailTokens).toBe(2);
    const remaining = (await prisma.emailToken.findMany({ select: { id: true } })).map(({ id }) => id);
    expect(remaining.sort()).toEqual([usedRecently.id, stillValid.id].sort());
    expect(remaining).not.toContain(usedLongAgo.id);
    expect(remaining).not.toContain(expiredLongAgo.id);
  });

  it('deletes daily alerts 90 days after their day', async () => {
    await alert(daysAgo(91));
    const kept = await alert(daysAgo(89));
    const today = await alert(daysAgo(0));

    const result = await app.get(PurgeService).purgeExpiredData(NOW);

    expect(result.alerts).toBe(1);
    const remaining = (await prisma.alert.findMany({ select: { id: true } })).map(({ id }) => id);
    expect(remaining.sort()).toEqual([kept.id, today.id].sort());
  });

  it('never touches accounts, households or pantry items', async () => {
    await prisma.pantryItem.create({
      data: { householdId, name: 'Riz', expiryDate: daysAgo(400), expiryType: 'DDM' },
    });

    await app.get(PurgeService).purgeExpiredData(NOW);

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.household.count()).toBe(1);
    expect(await prisma.pantryItem.count()).toBe(1);
  });
});
