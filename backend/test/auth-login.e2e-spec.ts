import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TERMS_VERSION } from '../src/users/terms.js';

const EMAIL = 'marie@example.com';
const PASSWORD = 'correct horse battery staple';

describe('POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ termsVersion: TERMS_VERSION, email: EMAIL, password: PASSWORD })
      .expect(201);
    userId = res.body.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const login = (body: object) => request(app.getHttpServer()).post('/auth/login').send(body);

  const getRefreshCookie = (res: request.Response): string => {
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const cookie = cookies.find((c) => c.startsWith('refresh_token='));
    if (!cookie) throw new Error('refresh_token cookie not set');
    return cookie;
  };

  it('returns an access token for this user, and nothing else in the body', async () => {
    const res = await login({ email: EMAIL, password: PASSWORD }).expect(200);

    expect(Object.keys(res.body)).toEqual(['accessToken']);
    const payload = await app.get(JwtService).verifyAsync(res.body.accessToken);
    expect(payload.sub).toBe(userId);
  });

  it('sets the refresh token in a hardened cookie', async () => {
    const res = await login({ email: EMAIL, password: PASSWORD }).expect(200);
    const cookie = getRefreshCookie(res);

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/auth');
  });

  it('stores only the SHA-256 hash of the refresh token', async () => {
    const res = await login({ email: EMAIL, password: PASSWORD }).expect(200);
    const token = getRefreshCookie(res).split(';')[0].split('=')[1];

    const stored = await prisma.refreshToken.findFirstOrThrow({ where: { userId } });
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('accepts the email in any case', () => {
    return login({ email: 'MARIE@Example.com', password: PASSWORD }).expect(200);
  });

  it('gives the same generic answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await login({ email: EMAIL, password: 'wrong password!!' }).expect(401);
    const unknownEmail = await login({ email: 'nobody@example.com', password: PASSWORD }).expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.message).toBe('Invalid credentials');
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  it('rejects unexpected fields', () => {
    return login({ email: EMAIL, password: PASSWORD, admin: true }).expect(400);
  });
});
