import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';

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
    request(app.getHttpServer()).post('/auth/register').send(body);

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

  it('rejects a password shorter than 12 characters', () => {
    return register({ email: 'marie@example.com', password: 'short-pass1' }).expect(400);
  });

  it('rejects an invalid email', () => {
    return register({ email: 'not-an-email', password: VALID_PASSWORD }).expect(400);
  });

  it('rejects unexpected fields (mass assignment)', () => {
    return register({ email: 'marie@example.com', password: VALID_PASSWORD, role: 'OWNER' }).expect(400);
  });
});
