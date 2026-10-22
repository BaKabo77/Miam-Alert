import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OpenFoodFactsClient, OpenFoodFactsUnavailableError } from './open-food-facts.client.js';
import type { ProductData, ProductResponse } from './products.types.js';

const PRODUCT_SELECT = {
  id: true,
  barcode: true,
  name: true,
  brand: true,
  imageUrl: true,
  category: true,
  nutriscore: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openFoodFacts: OpenFoodFactsClient,
  ) {}

  async findByBarcode(barcode: string): Promise<ProductResponse> {
    // Cache : un produit déjà connu est servi depuis la base, sans appel externe.
    const cached = await this.prisma.product.findUnique({
      where: { barcode },
      select: PRODUCT_SELECT,
    });
    if (cached) {
      return cached;
    }

    let data: ProductData | null;
    try {
      data = await this.openFoodFacts.fetchProduct(barcode);
    } catch (error) {
      if (error instanceof OpenFoodFactsUnavailableError) {
        this.logger.warn(`Open Food Facts unavailable: ${error.message}`);
        // 503 sans détail : l'application reste utilisable, l'utilisateur saisit le produit à la main.
        throw new ServiceUnavailableException('Product lookup is temporarily unavailable');
      }
      throw error;
    }

    if (!data) {
      throw new NotFoundException('Product not found');
    }

    // upsert plutôt que create : si deux utilisateurs scannent le même produit au même instant,
    // la contrainte d'unicité du code-barres ne provoque pas d'erreur.
    return this.prisma.product.upsert({
      where: { barcode },
      create: data,
      update: {},
      select: PRODUCT_SELECT,
    });
  }
}
