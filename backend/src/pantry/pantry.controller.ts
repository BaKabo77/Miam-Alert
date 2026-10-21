import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { Paginated } from '../common/pagination.js';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto.js';
import { ListPantryItemsQuery } from './dto/list-pantry-items.query.js';
import { PantryService } from './pantry.service.js';
import type { PantryItemResponse } from './pantry.types.js';

// Routes protégées (aucune n'est @Public()) : access token obligatoire.
// Le foyer est désigné dans l'URL, et le service vérifie que l'utilisateur en est membre.
@Controller('households/:householdId/pantry-items')
export class PantryController {
  constructor(private readonly pantry: PantryService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    // Un identifiant mal formé est rejeté (400) avant d'atteindre la base.
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: CreatePantryItemDto,
  ): Promise<PantryItemResponse> {
    return this.pantry.create(user.id, householdId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query() query: ListPantryItemsQuery,
  ): Promise<Paginated<PantryItemResponse>> {
    return this.pantry.list(user.id, householdId, query);
  }
}
