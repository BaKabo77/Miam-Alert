import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Lettres et chiffres de toutes les langues, espaces et ponctuation courante : « Coloc du 12 »,
// « Famille N'Diaye ». Ni balise, ni caractère de contrôle : le nom est affiché à tous les membres.
const HOUSEHOLD_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} '’.,&()-]*$/u;

export class RenameHouseholdDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(HOUSEHOLD_NAME_PATTERN, { message: 'name contains forbidden characters' })
  name: string;
}
