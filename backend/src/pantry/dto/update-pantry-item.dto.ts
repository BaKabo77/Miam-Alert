import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { IsOptionalNotNull } from '../../common/validators.js';
import { ExpiryType, PantryItemStatus, QuantityUnit } from '../../generated/prisma/client.js';
import { DATE_ONLY_PATTERN } from '../dates.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Modification partielle : seuls les champs envoyés changent. Toujours pas de householdId :
// un article ne peut pas être déplacé vers un autre foyer (le ValidationPipe le rejette).
export class UpdatePantryItemDto {
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @IsOptionalNotNull()
  @IsEnum(QuantityUnit)
  unit?: QuantityUnit;

  @IsOptionalNotNull()
  @Matches(DATE_ONLY_PATTERN)
  @IsISO8601({ strict: true })
  expiryDate?: string;

  @IsOptionalNotNull()
  @IsEnum(ExpiryType)
  expiryType?: ExpiryType;

  @IsOptionalNotNull()
  @IsEnum(PantryItemStatus)
  status?: PantryItemStatus;
}
