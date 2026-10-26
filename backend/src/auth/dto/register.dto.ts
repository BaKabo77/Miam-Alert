import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsOptionalPersonName } from '../../users/person-name.js';

export class RegisterDto {

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  // Facultatifs : on ne demande que ce qui sert (minimisation RGPD).
  @IsOptionalPersonName()
  firstName?: string;

  @IsOptionalPersonName()
  lastName?: string;
}
