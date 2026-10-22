import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsOptionalNotNull } from '../../common/validators.js';
import { ExpiryType, QuantityUnit } from '../../generated/prisma/client.js';
import { DATE_ONLY_PATTERN } from '../dates.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Ni householdId (il vient de l'URL, vérifié), ni status (toujours ACTIVE à la création) :
// le ValidationPipe rejette ces champs s'ils sont envoyés (mass assignment).
export class CreatePantryItemDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Entier positif borné : pas de quantité négative, nulle ou absurde.
  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @IsOptionalNotNull()
  @IsEnum(QuantityUnit)
  unit?: QuantityUnit;

  // Format "YYYY-MM-DD" ET date réelle (strict : le 30 février est refusé).
  @Matches(DATE_ONLY_PATTERN)
  @IsISO8601({ strict: true })
  expiryDate: string;

  @IsEnum(ExpiryType)
  expiryType: ExpiryType;

  @IsOptionalNotNull()
  @IsUUID()
  productId?: string;
}
