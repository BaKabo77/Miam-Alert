import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { IsOptionalNotNull } from './validators.js';

// Taille de page maximale : sans borne, ?pageSize=1000000 ferait charger toute une table
// en mémoire (déni de service, et fuite de volume de données).
export const MAX_PAGE_SIZE = 100;

export class PaginationQuery {
  // Les paramètres d'URL sont toujours des chaînes : @Type les convertit explicitement
  // (la conversion implicite est désactivée dans le ValidationPipe).
  @IsOptionalNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptionalNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
