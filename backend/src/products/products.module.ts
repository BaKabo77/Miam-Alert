import { Module } from '@nestjs/common';
import { OpenFoodFactsClient } from './open-food-facts.client.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [ProductsController],
  // Le client Open Food Facts est un provider : les tests peuvent le remplacer par un faux,
  // sans toucher au service (injection de dépendances).
  providers: [ProductsService, OpenFoodFactsClient],
})
export class ProductsModule {}
