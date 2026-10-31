import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TEST_PASSWORD } from './setup/test-users.js';
import { TERMS_VERSION } from '../src/users/terms.js';

const EMAIL = 'marie@example.com';
const NEW_PASSWORD = 'une toute nouvelle phrase de passe';

function refreshCookie(res: request.Response): string {
  return ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='))!;
}

describe('POST /auth/change-password (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let cookie: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    await request(app.getHttpServer()).post('/auth/register').send({ termsVersion: TERMS_VERSION, email: EMAIL, password: TEST_PASSWORD }).expect(201);
    const login = await login_(TEST_PASSWORD).expect(200);
    accessToken = login.body.accessToken;
    cookie = refreshCookie(login);
  });

  afterEach(async () => {
    await app.close();
  });

  function login_(password: string) {
    return request(app.getHttpServer()).post('/auth/login').send({ email: EMAIL, password });
  }

  const changePassword = (body: object, token: string | undefined = accessToken) => {
    const req = request(app.getHttpServer()).post('/auth/change-password').send(body);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('requires an access token', async () => {
    await changePassword({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD }, '').expect(401);
  });

  it('refuses a wrong current password with 403 and changes nothing', async () => {
    await changePassword({ currentPassword: 'not the right password', newPassword: NEW_PASSWORD }).expect(403);

    await login_(TEST_PASSWORD).expect(200);
    await login_(NEW_PASSWORD).expect(401);
  });

  it.each([
    ['a missing current password', { newPassword: NEW_PASSWORD }],
    ['a new password under 12 characters', { currentPassword: TEST_PASSWORD, newPassword: 'trop court' }],
    ['an overlong new password', { currentPassword: TEST_PASSWORD, newPassword: 'x'.repeat(129) }],
    ['the same password', { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD }],
    ['an unknown field', { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, userId: 'someone-else' }],
  ])('rejects %s with 400', async (_case, body) => {
    await changePassword(body).expect(400);
    await login_(TEST_PASSWORD).expect(200);
  });

  it('replaces the password: the old one stops working, the new one works', async () => {
    await changePassword({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD }).expect(200);

    await login_(TEST_PASSWORD).expect(401);
    await login_(NEW_PASSWORD).expect(200);

    const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL }, select: { passwordHash: true } });
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(NEW_PASSWORD);
  });

  it('signs out every other session and opens a new one for the current device', async () => {
    // Une deuxième session, sur un autre appareil (ou entre les mains d'un voleur).
    const otherDevice = refreshCookie(await login_(TEST_PASSWORD).expect(200));

    const res = await changePassword({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD }).expect(200);

    expect(res.body).toEqual({ accessToken: expect.any(String) });
    const newCookie = refreshCookie(res);
    expect(newCookie).toContain('HttpOnly');

    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', otherDevice).expect(401);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', newCookie).expect(200);
  });
});
