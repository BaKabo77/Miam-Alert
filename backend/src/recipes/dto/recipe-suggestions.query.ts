import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { IsOptionalNotNull } from '../../common/validators.js';

// Nombre de suggestions borné : la réponse reste petite, quelle que soit la demande.
export const MAX_SUGGESTIONS = 20;

export class RecipeSuggestionsQuery {
  @IsOptionalNotNull()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SUGGESTIONS)
  limit: number = 10;
}
