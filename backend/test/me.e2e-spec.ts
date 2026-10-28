import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';

const EMAIL = 'marie@example.com';
const PASSWORD = 'correct horse battery staple';

describe('GET /me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const server = app.getHttpServer();
    const registered = await request(server)
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(201);
    userId = registered.body.id;

    const loggedIn = await request(server)
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    accessToken = loggedIn.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  const getMe = (token?: string) => {
    const req = request(app.getHttpServer()).get('/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('requires an access token', () => {
    return getMe().expect(401);
  });

  it('returns the profile and households, without any sensitive field', async () => {
    const res = await getMe(accessToken).expect(200);

    expect(res.body).toEqual({
      id: userId,
      email: EMAIL,
      firstName: null,
      lastName: null,
      emailVerified: false,
      households: [{ id: expect.any(String), name: 'Mon foyer', role: 'OWNER' }],
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects a still-valid token whose account has been deleted', async () => {
    await prisma.user.delete({ where: { id: userId } });

    await getMe(accessToken).expect(401);
  });

  describe('PATCH /me', () => {
    const updateMe = (body: object, token: string | undefined = accessToken) => {
      const req = request(app.getHttpServer()).patch('/me');
      return (token ? req.set('Authorization', `Bearer ${token}`) : req).send(body);
    };

    it('requires an access token', async () => {
      await updateMe({ firstName: 'Marie' }, '').expect(401);
    });

    it('sets the first and last name, cleaned of extra spaces', async () => {
      const res = await updateMe({ firstName: '  Marie-Ève ', lastName: "N'Diaye  Le Gall" }).expect(200);

      expect(res.body).toMatchObject({ firstName: 'Marie-Ève', lastName: "N'Diaye Le Gall" });
    });

    it('only changes the fields that are sent', async () => {
      await updateMe({ firstName: 'Marie', lastName: 'Curie' }).expect(200);

      const res = await updateMe({ firstName: 'Irène' }).expect(200);

      expect(res.body).toMatchObject({ firstName: 'Irène', lastName: 'Curie' });
    });

    it('erases a name sent as null or blank (right to rectification)', async () => {
      await updateMe({ firstName: 'Marie', lastName: 'Curie' }).expect(200);

      const res = await updateMe({ firstName: null, lastName: '   ' }).expect(200);

      expect(res.body).toMatchObject({ firstName: null, lastName: null });
    });

    it.each([
      ['a name with digits', { firstName: 'Marie2' }],
      ['an HTML tag', { lastName: '<script>alert(1)</script>' }],
      ['a control character', { firstName: 'Ma\u0000rie' }],
      ['a name that is too long', { lastName: 'a'.repeat(101) }],
      ['a non-string value', { firstName: 42 }],
      ['another field (mass assignment)', { email: 'pirate@example.com' }],
    ])('rejects %s', async (_label, body) => {
      await updateMe(body).expect(400);
    });
  });
});
