import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './setup/reset-database.js';
import { createTestUser, TestUser } from './setup/test-users.js';

describe('Pantry items linked to a product (e2e)', () => {
  let app: INestApplication<App>;
  let marie: TestUser;
  let productId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    marie = await createTestUser(app, 'marie@example.com');

    // Fiche déjà présente dans le cache, comme après un GET /products/:barcode.
    const product = await prisma.product.create({
      data: {
        barcode: '3017620422003',
        name: 'Nutella',
        brand: 'Ferrero',
        imageUrl: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front.jpg',
        nutriscore: 'E',
      },
    });
    productId = product.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const create = (body: object) =>
    request(app.getHttpServer())
      .post(`/households/${marie.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${marie.accessToken}`)
      .send({ name: 'Nutella', expiryDate: '2030-01-01', expiryType: 'DDM', ...body });

  it('links the item to the product and returns a summary of it', async () => {
    const res = await create({ productId }).expect(201);
    console.log(res.body, 'res.body in pantry-product.e2e-spec.ts');

    expect(res.body.product).toEqual({
      id: productId,
      barcode: '3017620422003',
      brand: 'Ferrero',
      imageUrl: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front.jpg',
      nutriscore: 'E',
    });
  });

  it('includes the product summary when listing the inventory', async () => {
    await create({ productId }).expect(201);

    const res = await request(app.getHttpServer())
      .get(`/households/${marie.householdId}/pantry-items`)
      .set('Authorization', `Bearer ${marie.accessToken}`)
      .expect(200);

    expect(res.body.items[0].product).toMatchObject({ id: productId, nutriscore: 'E' });
  });

  it('rejects a product that does not exist', async () => {
    await create({ productId: '00000000-0000-4000-8000-000000000000' }).expect(400);
  });

  it('rejects a malformed product id', async () => {
    await create({ productId: 'nutella' }).expect(400);
  });
});
