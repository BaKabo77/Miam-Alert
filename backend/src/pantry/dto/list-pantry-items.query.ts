import { IsEnum } from 'class-validator';
import { PaginationQuery } from '../../common/pagination.js';
import { IsOptionalNotNull } from '../../common/validators.js';
import { PantryItemStatus } from '../../generated/prisma/client.js';

export class ListPantryItemsQuery extends PaginationQuery {
  // Par défaut, l'inventaire actuel : les articles consommés ou jetés sont l'historique.
  @IsOptionalNotNull()
  @IsEnum(PantryItemStatus)
  status: PantryItemStatus = PantryItemStatus.ACTIVE;
}