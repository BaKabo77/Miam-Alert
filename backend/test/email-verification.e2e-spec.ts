import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Mailer, type MailMessage } from '../src/mail/mailer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TEST_PASSWORD } from './setup/test-users.js';

const EMAIL = 'marie@example.com';

// Faux serveur d'emails : les messages sont gardés en mémoire, aucun n'est envoyé.
class FakeMailer extends Mailer {
  readonly sent: MailMessage[] = [];
  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

describe('Email verification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailer: FakeMailer;
  let accessToken: string;

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
    await request(server).post('/auth/register').send({ email: EMAIL, password: TEST_PASSWORD }).expect(201);
    accessToken = (await request(server).post('/auth/login').send({ email: EMAIL, password: TEST_PASSWORD }).expect(200)).body
      .accessToken;
    await waitForEmails(1);
  });

  afterEach(async () => {
    await app.close();
  });

  // L'email d'inscription part en arrière-plan : on attend qu'il soit « envoyé ».
  async function waitForEmails(count: number) {
    for (let i = 0; i < 50 && mailer.sent.length < count; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(mailer.sent).toHaveLength(count);
  }

  function tokenFrom(message: MailMessage): string {
    return /#token=([A-Za-z0-9_-]{43})/.exec(message.text)![1];
  }

  const verify = (token: unknown) => request(app.getHttpServer()).post('/auth/verify-email').send({ token });
  const resend = (token: string | undefined = accessToken) => {
    const req = request(app.getHttpServer()).post('/auth/verify-email/resend');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const emailVerified = async () =>
    (await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${accessToken}`).expect(200)).body
      .emailVerified;

  it('sends a link to the new address at registration, with the token in the URL fragment', async () => {
    const [message] = mailer.sent;

    expect(message.to).toBe(EMAIL);
    expect(message.text).toMatch(/^http:\/\/localhost:5173\/verify-email#token=[A-Za-z0-9_-]{43}$/m);
    expect(await emailVerified()).toBe(false);
  });

  it('stores only a hash of the token', async () => {
    const token = tokenFrom(mailer.sent[0]);
    const stored = await prisma.emailToken.findFirstOrThrow({ select: { tokenHash: true } });

    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.tokenHash).not.toBe(token);
  });

  it('verifies the address with the link, which then cannot be reused', async () => {
    const token = tokenFrom(mailer.sent[0]);

    await verify(token).expect(204);
    expect(await emailVerified()).toBe(true);

    await verify(token).expect(400);
  });

  it.each([
    ['a malformed token', 'not-a-token'],
    ['a non-string token', { $ne: null }],
    ['an unknown token', 'A'.repeat(43)],
  ])('rejects %s with 400', async (_case, token) => {
    await verify(token).expect(400);
    expect(await emailVerified()).toBe(false);
  });

  it('rejects an expired link', async () => {
    await prisma.emailToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    await verify(tokenFrom(mailer.sent[0])).expect(400);
    expect(await emailVerified()).toBe(false);
  });

  it('resend requires to be logged in', async () => {
    await resend('').expect(401);
  });

  it('does not resend within a minute (no mailbox flooding)', async () => {
    await resend().expect(204);
    await resend().expect(204);

    expect(mailer.sent).toHaveLength(1);
  });

  it('resends a new link after a minute, and the previous one stops working', async () => {
    const firstToken = tokenFrom(mailer.sent[0]);
    await prisma.emailToken.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });

    await resend().expect(204);
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1].to).toBe(EMAIL);

    await verify(firstToken).expect(400);
    await verify(tokenFrom(mailer.sent[1])).expect(204);
  });

  it('sends nothing once the address is verified', async () => {
    await verify(tokenFrom(mailer.sent[0])).expect(204);
    await prisma.emailToken.updateMany({ data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });

    await resend().expect(204);
    expect(mailer.sent).toHaveLength(1);
  });

  it('never puts user-provided text in the email', async () => {
    const [message] = mailer.sent;
    expect(message.html).not.toContain('<script');
    expect(message.subject).not.toContain(EMAIL);
  });
});
