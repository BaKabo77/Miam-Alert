import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Mailer, type MailMessage } from '../src/mail/mailer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TEST_PASSWORD } from './setup/test-users.js';
import { TERMS_VERSION } from '../src/users/terms.js';

const EMAIL = 'marie@example.com';
const NEW_PASSWORD = 'une toute nouvelle phrase de passe';

class FakeMailer extends Mailer {
  readonly sent: MailMessage[] = [];
  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

describe('Forgotten password (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailer: FakeMailer;
  let sessionCookie: string;

  beforeEach(async () => {
    mailer = new FakeMailer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Mailer)
      .useValue(mailer)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const server = app.getHttpServer();
    await request(server).post('/auth/register').send({ termsVersion: TERMS_VERSION, email: EMAIL, password: TEST_PASSWORD }).expect(201);
    const login = await request(server).post('/auth/login').send({ email: EMAIL, password: TEST_PASSWORD }).expect(200);
    sessionCookie = ([] as string[]).concat(login.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='))!;
    await waitFor(() => mailer.sent.length === 1); // email de vérification de l'inscription
    mailer.sent.length = 0;
  });

  afterEach(async () => {
    await app.close();
  });

  async function waitFor(condition: () => boolean) {
    for (let i = 0; i < 50 && !condition(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  // Les envois partent en arrière-plan : on laisse le temps au travail de se faire.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
  const tokenFrom = (message: MailMessage) => /#token=([A-Za-z0-9_-]{43})/.exec(message.text)![1];
  const forgot = (email: unknown) => request(app.getHttpServer()).post('/auth/forgot-password').send({ email });
  const reset = (body: object) => request(app.getHttpServer()).post('/auth/reset-password').send(body);
  const login = (password: string) =>
    request(app.getHttpServer()).post('/auth/login').send({ email: EMAIL, password });

  async function requestLink(): Promise<string> {
    await forgot(EMAIL).expect(204);
    await waitFor(() => mailer.sent.length > 0);
    expect(mailer.sent).toHaveLength(1);
    return tokenFrom(mailer.sent[0]);
  }

  it('answers exactly the same for a known and an unknown address (no account enumeration)', async () => {
    const known = await forgot(EMAIL).expect(204);
    const unknown = await forgot('personne@example.com').expect(204);

    expect(unknown.text).toBe(known.text);
    await settle();
    expect(mailer.sent.map((message) => message.to)).toEqual([EMAIL]);
  });

  it('accepts the address whatever its case, like the login', async () => {
    await forgot('  Marie@Example.COM ').expect(204);
    await waitFor(() => mailer.sent.length > 0);
    expect(mailer.sent[0].to).toBe(EMAIL);
  });

  it('rejects a malformed address with 400', async () => {
    await forgot('not-an-email').expect(400);
  });

  it('sends at most one email per minute to the same address', async () => {
    await forgot(EMAIL).expect(204);
    await forgot(EMAIL).expect(204);
    await settle();

    expect(mailer.sent).toHaveLength(1);
  });

  it('still sends a single email when requests arrive at the same time', async () => {
    await Promise.all(Array.from({ length: 5 }, () => forgot(EMAIL).expect(204)));
    await settle();

    expect(mailer.sent).toHaveLength(1);
    expect(await prisma.emailToken.count({ where: { purpose: 'PASSWORD_RESET' } })).toBe(1);
  });

  it('sends a 30-minute link with the token in the URL fragment', async () => {
    const token = await requestLink();

    expect(mailer.sent[0].text).toContain(`http://localhost:5173/reset-password#token=${token}`);
    const stored = await prisma.emailToken.findFirstOrThrow({ where: { purpose: 'PASSWORD_RESET' } });
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(30 * 60 * 1000);
  });

  it('replaces the password, closes every session and confirms the address', async () => {
    const token = await requestLink();

    await reset({ token, newPassword: NEW_PASSWORD }).expect(204);

    await login(TEST_PASSWORD).expect(401);
    await login(NEW_PASSWORD).expect(200);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', sessionCookie).expect(401);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL }, select: { emailVerifiedAt: true } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('accepts each link only once', async () => {
    const token = await requestLink();

    await reset({ token, newPassword: NEW_PASSWORD }).expect(204);
    await reset({ token, newPassword: 'encore une autre phrase de passe' }).expect(400);
    await login(NEW_PASSWORD).expect(200);
  });

  it('rejects an expired link', async () => {
    const token = await requestLink();
    await prisma.emailToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    await reset({ token, newPassword: NEW_PASSWORD }).expect(400);
    await login(TEST_PASSWORD).expect(200);
  });

  it('does not accept an email verification link to change the password', async () => {
    await prisma.emailToken.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });
    const { accessToken } = (await login(TEST_PASSWORD).expect(200)).body;
    await request(app.getHttpServer())
      .post('/auth/verify-email/resend')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
    await waitFor(() => mailer.sent.length > 0);

    await reset({ token: tokenFrom(mailer.sent[0]), newPassword: NEW_PASSWORD }).expect(400);
    await login(TEST_PASSWORD).expect(200);
  });

  it('only the latest link works', async () => {
    const first = await requestLink();
    await prisma.emailToken.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });
    await forgot(EMAIL).expect(204);
    await waitFor(() => mailer.sent.length === 2);

    await reset({ token: first, newPassword: NEW_PASSWORD }).expect(400);
    await reset({ token: tokenFrom(mailer.sent[1]), newPassword: NEW_PASSWORD }).expect(204);
  });

  it.each([
    ['a too short password', { newPassword: 'trop court' }],
    ['an unknown field', { newPassword: NEW_PASSWORD, email: 'someone-else@example.com' }],
  ])('rejects %s with 400 without using up the link', async (_case, body) => {
    const token = await requestLink();

    await reset({ token, ...body }).expect(400);
    await reset({ token, newPassword: NEW_PASSWORD }).expect(204);
  });

  it('rejects a malformed token with 400', async () => {
    await reset({ token: 'not-a-token', newPassword: NEW_PASSWORD }).expect(400);
  });
});
