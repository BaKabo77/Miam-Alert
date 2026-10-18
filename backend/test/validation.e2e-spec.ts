import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { IsString, MaxLength } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createValidationPipe } from '../src/common/validation.js';

class CreateItemDto {
  @IsString()
  @MaxLength(10)
  name: string;
}

@Controller('items')
class ItemsController {
  @Post()
  create(@Body() dto: CreateItemDto) {
    return dto;
  }
}

describe('Global validation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [{ provide: APP_PIPE, useFactory: createValidationPipe }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid body', () => {
    return request(app.getHttpServer())
      .post('/items')
      .send({ name: 'milk' })
      .expect(201)
      .expect({ name: 'milk' });
  });

  it('rejects an unknown field (mass assignment)', () => {
    return request(app.getHttpServer())
      .post('/items')
      .send({ name: 'milk', householdId: 'someone-else' })
      .expect(400);
  });

  it('rejects a value that is too long', () => {
    return request(app.getHttpServer())
      .post('/items')
      .send({ name: 'a'.repeat(11) })
      .expect(400);
  });

  it('rejects a wrong type', () => {
    return request(app.getHttpServer())
      .post('/items')
      .send({ name: 123 })
      .expect(400);
  });
});
