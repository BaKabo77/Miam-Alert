import { Controller, Get, INestApplication, NotFoundException } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter.js';

@Controller('errors')
class ErrorsController {
  @Get('unexpected')
  unexpected() {
    // Simule une erreur interne qui contient des informations sensibles.
    throw new Error('connection failed: postgresql://admin:s3cret@db:5432/miam_alert');
  }

  @Get('not-found')
  notFound() {
    throw new NotFoundException('Item not found');
  }
}

describe('Global exception filter (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErrorsController],
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    }).compile();

    // logger: false : l'erreur simulée est volontaire, inutile de polluer la sortie des tests.
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('hides internal details of unexpected errors', async () => {
    const res = await request(app.getHttpServer()).get('/errors/unexpected').expect(500);

    expect(res.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(res.text).not.toContain('s3cret');
    expect(res.text).not.toContain('postgresql');
  });

  it('keeps intentional HTTP errors as they are', async () => {
    const res = await request(app.getHttpServer()).get('/errors/not-found').expect(404);

    expect(res.body.message).toBe('Item not found');
  });
});
