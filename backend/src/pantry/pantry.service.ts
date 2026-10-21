import { Injectable } from '@nestjs/common';
import type { Paginated } from '../common/pagination.js';
import { HouseholdAccessService } from '../households/household-access.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseDateOnly, todayUtc } from './dates.js';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto.js';
import { ListPantryItemsQuery } from './dto/list-pantry-items.query.js';
import { PANTRY_ITEM_SELECT, toPantryItemResponse } from './pantry.mapper.js';
import type { PantryItemResponse } from './pantry.types.js';

@Injectable()
export class PantryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly householdAccess: HouseholdAccessService,
  ) {}

  async create(
    userId: string,
    householdId: string,
    dto: CreatePantryItemDto,
  ): Promise<PantryItemResponse> {
    await this.householdAccess.assertMember(userId, householdId);

    const item = await this.prisma.pantryItem.create({
      data: {
        householdId,
        name: dto.name,
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
}
