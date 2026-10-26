import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { applyTrustProxy } from '../src/common/trust-proxy.js';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return 'pong';
  }
}

async function createApp(trustedProxyHops: number): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 3 }])],
    controllers: [PingController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  applyTrustProxy(app, trustedProxyHops);
  await app.init();
  return app;
}

describe('Global rate limiting (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 once the limit is exceeded', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < 3; i++) {
      await request(server).get('/ping').expect(200);
    }

    const blocked = await request(server).get('/ping').expect(429);
    // Le client sait quand réessayer, sans qu'on révèle autre chose.
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('ignores X-Forwarded-For without a trusted proxy (no bypass by faking the IP)', async () => {
    // La limite est déjà atteinte par le test précédent : changer d'IP "déclarée" n'y change rien.
    await request(app.getHttpServer())
      .get('/ping')
      .set('X-Forwarded-For', '203.0.113.99')
      .expect(429);
  });
});

describe('Rate limiting behind one reverse proxy (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp(1);
  });

  afterAll(async () => {
    await app.close();
  });

  it('counts each client separately, using the IP added by the proxy', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < 3; i++) {
      await request(server).get('/ping').set('X-Forwarded-For', '198.51.100.1').expect(200);
    }
    await request(server).get('/ping').set('X-Forwarded-For', '198.51.100.1').expect(429);

    // Un autre utilisateur n'est pas pénalisé par le premier.
    await request(server).get('/ping').set('X-Forwarded-For', '198.51.100.2').expect(200);
  });

  it('only trusts the last hop: an IP faked by the client does not bypass the limit', async () => {
    const server = app.getHttpServer();

    // Le client invente une IP différente à chaque requête ; le proxy ajoute la vraie à la fin.
    for (let i = 0; i < 3; i++) {
      await request(server)
        .get('/ping')
        .set('X-Forwarded-For', `10.0.0.${i}, 198.51.100.3`)
        .expect(200);
    }
    await request(server)
      .get('/ping')
      .set('X-Forwarded-For', '10.0.0.99, 198.51.100.3')
      .expect(429);
  });
});
