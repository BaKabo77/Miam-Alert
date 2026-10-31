import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { TERMS_VERSION } from '../src/users/terms.js';

const EMAIL = 'marie@example.com';
const PASSWORD = 'correct horse battery staple';

// Extrait la valeur du cookie refresh_token d'une réponse.
function refreshTokenFrom(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('refresh_token cookie not set');
  return cookie.split(';')[0].split('=')[1];
}

describe('POST /auth/refresh and /auth/logout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ termsVersion: TERMS_VERSION, email: EMAIL, password: PASSWORD })
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  const login = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    return refreshTokenFrom(res);
  };

  const refresh = (token?: string) => {
    const req = request(app.getHttpServer()).post('/auth/refresh');
    return token ? req.set('Cookie', `refresh_token=${token}`) : req;
  };

  const logout = (token?: string) => {
    const req = request(app.getHttpServer()).post('/auth/logout');
    return token ? req.set('Cookie', `refresh_token=${token}`) : req;
  };

  describe('refresh', () => {
    it('returns a new access token and rotates the refresh token', async () => {
      const token = await login();

      const res = await refresh(token).expect(200);

      expect(Object.keys(res.body)).toEqual(['accessToken']);
      expect(refreshTokenFrom(res)).not.toBe(token);
    });

    it('keeps the session alive across several rotations', async () => {
      let token = await login();
      for (let i = 0; i < 3; i++) {
        token = refreshTokenFrom(await refresh(token).expect(200));
      }
    });

    it('detects the reuse of a rotated token and revokes the whole session', async () => {
      const stolen = await login();
      const current = refreshTokenFrom(await refresh(stolen).expect(200));

      // L'ancien token revient : vol probable.
      await refresh(stolen).expect(401);
      // Le token légitime le plus récent est révoqué lui aussi.
      await refresh(current).expect(401);
    });

    it('rejects a request without cookie', () => {
      return refresh().expect(401);
    });

    it('rejects a malformed or unknown token', async () => {
      await refresh('not-a-real-token').expect(401);
      await refresh('A'.repeat(43)).expect(401);
    });

    it('rejects an expired token', async () => {
      const token = await login();
      await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      await refresh(token).expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the session server side and clears the cookie', async () => {
      const token = await login();

      const res = await logout(token).expect(204);

      const cleared = ([] as string[])
        .concat(res.headers['set-cookie'] ?? [])
        .find((c) => c.startsWith('refresh_token=;'));
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
      // Même si quelqu'un a gardé une copie du cookie, il ne sert plus à rien.
      await refresh(token).expect(401);
    });

    it('only revokes the current session, not the other devices', async () => {
      const phone = await login();
      const laptop = await login();

      await logout(phone).expect(204);

      await refresh(phone).expect(401);
      await refresh(laptop).expect(200);
    });

    it('succeeds without cookie (nothing to revoke)', () => {
      return logout().expect(204);
    });
  });
});
