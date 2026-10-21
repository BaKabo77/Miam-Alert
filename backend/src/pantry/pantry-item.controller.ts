import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto.js';
import { PantryService } from './pantry.service.js';
import type { PantryItemResponse } from './pantry.types.js';

// Routes protégées sur UN article, désigné par son id. Le foyer n'est pas dans l'URL :
// le service ne trouve l'article que s'il appartient à un foyer de l'utilisateur connecté.
@Controller('pantry-items/:itemId')
export class PantryItemController {
  constructor(private readonly pantry: PantryService) {}

  @Get()
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<PantryItemResponse> {
    return this.pantry.findOne(user.id, itemId);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePantryItemDto,
  ): Promise<PantryItemResponse> {
    return this.pantry.update(user.id, itemId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.pantry.remove(user.id, itemId);
  }
}
