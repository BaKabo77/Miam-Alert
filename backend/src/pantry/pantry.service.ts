import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '../common/pagination.js';
import { Prisma } from '../generated/prisma/client.js';
import { HouseholdAccessService } from '../households/household-access.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { matchIngredient } from '../recipes/ingredient-matcher.js';
import { parseDateOnly, todayUtc } from './dates.js';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto.js';
import { ListPantryItemsQuery } from './dto/list-pantry-items.query.js';
import { PANTRY_ITEM_SELECT, toPantryItemResponse } from './pantry.mapper.js';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto.js';
import type { PantryItemResponse } from './pantry.types.js';

@Injectable()
export class PantryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly householdAccess: HouseholdAccessService,
  ) { }

  async create(
    userId: string,
    householdId: string,
    dto: CreatePantryItemDto,
  ): Promise<PantryItemResponse> {
    await this.householdAccess.assertMember(userId, householdId);

    const categories = dto.productId === undefined ? [] : await this.productCategories(dto.productId);

    const item = await this.prisma.pantryItem.create({
      data: {
        householdId,
        productId: dto.productId,
        name: dto.name,
        // Ingrédient reconnu par le serveur (fiche produit, sinon nom) : sert aux recettes.
        ingredientKey: matchIngredient({ name: dto.name, categories }),
        quantity: dto.quantity,
        unit: dto.unit,
        expiryDate: parseDateOnly(dto.expiryDate),
        expiryType: dto.expiryType,
      },
      select: PANTRY_ITEM_SELECT,
    });

    return toPantryItemResponse(item, todayUtc());
  }

  async list(
    userId: string,
    householdId: string,
    query: ListPantryItemsQuery,
  ): Promise<Paginated<PantryItemResponse>> {
    await this.householdAccess.assertMember(userId, householdId);

    const where = { householdId, status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pantryItem.findMany({
        where,
        select: PANTRY_ITEM_SELECT,
        // Tri par urgence : date la plus proche d'abord ; à date égale, la DLC (stricte)
        // passe avant la DDM (l'ordre de l'enum en base est DLC puis DDM).
        orderBy: [{ expiryDate: 'asc' }, { expiryType: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.pantryItem.count({ where }),
    ]);

    const today = todayUtc();
    return {
      items: items.map((item) => toPantryItemResponse(item, today)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findOne(userId: string, itemId: string): Promise<PantryItemResponse> {
    const item = await this.prisma.pantryItem.findUnique({
      where: accessibleItem(userId, itemId),
      select: PANTRY_ITEM_SELECT,
    });

    if (!item) {
      throw new NotFoundException('Pantry item not found');
    }
    return toPantryItemResponse(item, todayUtc());
  }

  async update(
    userId: string,
    itemId: string,
    dto: UpdatePantryItemDto,
  ): Promise<PantryItemResponse> {
    // Nouveau nom : l'ingrédient est reconnu de nouveau (la fiche produit, s'il y en a une, reste
    // prioritaire). L'article d'un autre foyer est introuvable dès cette lecture.
    let ingredientKey: string | null | undefined;
    if (dto.name !== undefined) {
      const current = await this.prisma.pantryItem.findUnique({
        where: accessibleItem(userId, itemId),
        select: { product: { select: { categories: true } } },
      });
      if (!current) {
        throw new NotFoundException('Pantry item not found');
      }
      ingredientKey = matchIngredient({ name: dto.name, categories: current.product?.categories });
    }

    try {
      const item = await this.prisma.pantryItem.update({
        where: accessibleItem(userId, itemId),
        // Champs recopiés un par un ; un champ absent (undefined) n'est pas modifié.
        data: {
          name: dto.name,
          ingredientKey,
          quantity: dto.quantity,
          unit: dto.unit,
          expiryDate: dto.expiryDate === undefined ? undefined : parseDateOnly(dto.expiryDate),
          expiryType: dto.expiryType,
          status: dto.status,
        },
        select: PANTRY_ITEM_SELECT,
      });
      return toPantryItemResponse(item, todayUtc());
    } catch (error) {
      throw notFoundIfMissing(error);
    }
  }

  async remove(userId: string, itemId: string): Promise<void> {
    try {
      await this.prisma.pantryItem.delete({ where: accessibleItem(userId, itemId) });
    } catch (error) {
      throw notFoundIfMissing(error);
    }
  }

  // Les fiches produits sont publiques et partagées : pas de contrôle de foyer ici, seulement
  // d'existence. Sans cette vérification, un id inconnu ferait échouer la clé étrangère en base
  // (erreur 500) au lieu d'un 400 explicite. Renvoie ses catégories (reconnaissance de l'ingrédient).
  private async productCategories(productId: string): Promise<string[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categories: true },
    });
    if (!product) {
      throw new BadRequestException('Unknown product');
    }
    return product.categories;
  }
}

// Filtre de toutes les requêtes sur UN article : il n'est trouvé que s'il appartient à un
// foyer dont l'utilisateur est membre. Le contrôle d'accès fait partie de la requête elle-même :
// l'article d'un autre foyer ne sort jamais de la base, il est simplement "introuvable".
function accessibleItem(userId: string, itemId: string) {
  return {
    id: itemId,
    household: { members: { some: { userId } } },
  } satisfies Prisma.PantryItemWhereUniqueInput;
}

// P2025 : aucune ligne ne correspond (article inexistant OU d'un autre foyer, indiscernables).
function notFoundIfMissing(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return new NotFoundException('Pantry item not found');
  }
  return error;
}
