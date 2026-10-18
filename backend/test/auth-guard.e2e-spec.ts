import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { AuthenticatedRequest } from '../src/auth/auth.types.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { buildJwtOptions } from '../src/auth/jwt.config.js';
import { Public } from '../src/auth/public.decorator.js';

const SECRET = 'test-secret-used-only-in-e2e-tests-0123456789';
const USER_ID = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';

@Controller()
class TestController {
  @Public()
  @Get('open')
  open() {
    return 'open';
  }

  @Get('protected')
  protectedRoute(@Req() req: AuthenticatedRequest) {
    return { userId: req.user?.id };
  }
}

const toBase64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('Global JWT guard (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register(buildJwtOptions(SECRET))],
      controllers: [TestController],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const getProtected = (authorization?: string) => {
    const req = request(app.getHttpServer()).get('/protected');
    return authorization ? req.set('Authorization', authorization) : req;
  };

  it('lets a @Public() route through without a token', () => {
    return request(app.getHttpServer()).get('/open').expect(200);
  });

  it('rejects a protected route without a token', () => {
    return getProtected().expect(401);
  });

  it('rejects a non-Bearer authorization header', () => {
    return getProtected('Basic dXNlcjpwYXNz').expect(401);
  });

  it('accepts a valid token and takes the user id from it', async () => {
    const token = await jwt.signAsync({ sub: USER_ID });
    const res = await getProtected(`Bearer ${token}`).expect(200);
    expect(res.body).toEqual({ userId: USER_ID });
  });

  it('rejects a token signed with another secret (forged)', async () => {
    const forged = await new JwtService({
      secret: 'attacker-secret-of-sufficient-length-0123456789',
    }).signAsync({ sub: USER_ID });
    return getProtected(`Bearer ${forged}`).expect(401);
  });

  it('rejects an expired token', async () => {
    const expired = await new JwtService({ secret: SECRET }).signAsync({
      sub: USER_ID,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    return getProtected(`Bearer ${expired}`).expect(401);
  });

  it('rejects an unsigned token (alg: none)', () => {
    const unsigned = `${toBase64Url({ alg: 'none', typ: 'JWT' })}.${toBase64Url({ sub: USER_ID })}.`;
    return getProtected(`Bearer ${unsigned}`).expect(401);
  });
});
