import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PRODUCTS_THROTTLE } from '../common/throttling.js';
import { ParseEanPipe } from './ean.js';
import { ProductsService } from './products.service.js';
import type { ProductResponse } from './products.types.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // Protégée (access token) mais sans contrôle de foyer : les fiches produits sont des données
  // publiques, partagées par tous. Le token empêche d'utiliser notre API comme relais anonyme
  // vers Open Food Facts, et la limite stricte l'empêche d'en aspirer le catalogue.
  @Get(':barcode')
  @Throttle(PRODUCTS_THROTTLE)
  findByBarcode(@Param('barcode', ParseEanPipe) barcode: string): Promise<ProductResponse> {
    return this.products.findByBarcode(barcode);
  }
}
