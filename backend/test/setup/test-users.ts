import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';

export const TEST_PASSWORD = 'correct horse battery staple';

export interface TestUser {
  accessToken: string;
  householdId: string;
}

// Crée un compte, le connecte et renvoie de quoi appeler l'API en son nom.
export async function createTestUser(app: INestApplication<App>, email: string): Promise<TestUser> {
  const server = app.getHttpServer();

  await request(server).post('/auth/register').send({ email, password: TEST_PASSWORD }).expect(201);
  const login = await request(server)
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  const accessToken: string = login.body.accessToken;

  const me = await request(server).get('/me').set('Authorization', `Bearer ${accessToken}`).expect(200);

  return { accessToken, householdId: me.body.households[0].id };
}