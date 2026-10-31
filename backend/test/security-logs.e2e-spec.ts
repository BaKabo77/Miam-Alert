import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TERMS_VERSION } from '../src/users/terms.js';

const EMAIL = 'marie@example.com';
const PASSWORD = 'correct horse battery staple';

describe('Security event logs (e2e)', () => {
  let app: INestApplication<App>;
  let messages: string[];

  beforeEach(async () => {
    // On intercepte tout ce qui passe par le Logger de Nest pendant le test.
    messages = [];
    const capture = (message: unknown) => {
      messages.push(String(message));
    };
    vi.spyOn(Logger.prototype, 'log').mockImplementation(capture);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(capture);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await resetDatabase(app.get(PrismaService));
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  const events = () =>
    messages.filter((m) => m.startsWith('{')).map((m) => JSON.parse(m).event as string);

  it('logs the authentication events without any secret or personal data', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({ termsVersion: TERMS_VERSION, email: EMAIL, password: PASSWORD, firstName: 'Marie', lastName: 'Curie' });
    await request(server).post('/auth/login').send({ email: EMAIL, password: 'wrong password!!' });
    const login = await request(server).post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    const cookie = ([] as string[]).concat(login.headers['set-cookie'] ?? [])[0].split(';')[0];
    await request(server).post('/auth/refresh').set('Cookie', cookie);

    expect(events()).toEqual([
      'auth.register',
      'auth.login.failure',
      'auth.login.success',
      'auth.refresh',
    ]);

    const allLogs = messages.join('\n');
    expect(allLogs).not.toContain(EMAIL);
    expect(allLogs).not.toContain('Curie');
    expect(allLogs).not.toContain(PASSWORD);
    expect(allLogs).not.toContain(login.body.accessToken);
    expect(allLogs).not.toContain(cookie.split('=')[1]);
  });

  it('logs rate limit violations', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < 11; i++) {
      await request(server).post('/auth/login').send({});
    }

    expect(events()).toContain('rate_limit.exceeded');
  });
});
