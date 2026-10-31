import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TERMS_VERSION } from '../src/users/terms.js';

const VALID_PASSWORD = 'correct horse battery staple';

describe('POST /auth/register (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Une application neuve par test : le compteur du rate limiting repart de zéro.
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await app.close();
  });

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send({ termsVersion: TERMS_VERSION, ...body });

  it('creates the account and returns only id and email', async () => {
    const res = await register({ email: 'marie@example.com', password: VALID_PASSWORD }).expect(201);

    expect(Object.keys(res.body).sort()).toEqual(['email', 'id']);
    expect(res.body.email).toBe('marie@example.com');
  });

  it('stores an argon2id hash, never the password', async () => {
    await register({ email: 'marie@example.com', password: VALID_PASSWORD }).expect(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'marie@example.com' },
      omit: { passwordHash: false },
    });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(VALID_PASSWORD);
  });

  it('creates a household owned by the new user', async () => {
    const res = await register({ email: 'marie@example.com', password: VALID_PASSWORD }).expect(201);

    const membership = await prisma.householdMember.findFirstOrThrow({
      where: { userId: res.body.id },
    });
    expect(membership.role).toBe('OWNER');
  });

  it('normalizes the email (trim, lowercase)', async () => {
    const res = await register({ email: '  Marie@Example.COM ', password: VALID_PASSWORD }).expect(201);

    expect(res.body.email).toBe('marie@example.com');
  });

  it('rejects an email that is already registered', async () => {
    await register({ email: 'marie@example.com', password: VALID_PASSWORD }).expect(201);
    await register({ email: 'MARIE@example.com', password: VALID_PASSWORD }).expect(409);
  });

  it('records the accepted version of the terms and when, with a date set by the server', async () => {
    await register({ email: 'marie@example.com', password: VALID_PASSWORD }).expect(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'marie@example.com' },
      select: { termsVersion: true, termsAcceptedAt: true },
    });
    expect(user.termsVersion).toBe(TERMS_VERSION);
    expect(Date.now() - user.termsAcceptedAt!.getTime()).toBeLessThan(60_000);
  });

  it.each([
    ['without accepting the terms', { termsVersion: undefined }],
    ['with an outdated version of the terms', { termsVersion: '2020-01-01' }],
    ['with an acceptance date chosen by the client', { termsAcceptedAt: '2000-01-01T00:00:00Z' }],
  ])('refuses to create an account %s', async (_label, body) => {
    await register({ email: 'marie@example.com', password: VALID_PASSWORD, ...body }).expect(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects a password shorter than 12 characters', () => {
    return register({ email: 'marie@example.com', password: 'short-pass1' }).expect(400);
  });

  it('rejects an invalid email', () => {
    return register({ email: 'not-an-email', password: VALID_PASSWORD }).expect(400);
  });

  it('rejects unexpected fields (mass assignment)', () => {
    return register({ email: 'marie@example.com', password: VALID_PASSWORD, role: 'OWNER' }).expect(400);
  });

  describe('optional first and last name', () => {
    const storedUser = (id: string) => prisma.user.findUniqueOrThrow({ where: { id } });

    it('stores the names when they are given', async () => {
      const res = await register({
        email: 'marie@example.com',
        password: VALID_PASSWORD,
        firstName: ' Marie ',
        lastName: 'Curie',
      }).expect(201);

      expect(await storedUser(res.body.id)).toMatchObject({ firstName: 'Marie', lastName: 'Curie' });
    });

    it('creates the account without names, or with blank names', async () => {
      const res = await register({
        email: 'marie@example.com',
        password: VALID_PASSWORD,
        firstName: '   ',
      }).expect(201);

      expect(await storedUser(res.body.id)).toMatchObject({ firstName: null, lastName: null });
    });

    it.each([
      ['a null name', { firstName: null }],
      ['a name with digits', { lastName: 'Curie 2' }],
      ['an HTML tag', { firstName: '<b>Marie</b>' }],
      ['a name that is too long', { firstName: 'a'.repeat(101) }],
    ])('rejects %s', async (_label, names) => {
      await register({ email: 'marie@example.com', password: VALID_PASSWORD, ...names }).expect(400);
    });
  });
});
