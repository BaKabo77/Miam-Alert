import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsOptionalPersonName } from '../../users/person-name.js';
import { TERMS_VERSION } from '../../users/terms.js';

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

  // Pas de compte sans acceptation des CGU : le client envoie la version qu'il a affichée, qui doit
  // être celle en vigueur. La date d'acceptation est fixée par le serveur.
  @Equals(TERMS_VERSION, { message: 'termsVersion must be the current version of the terms' })
  termsVersion: string;
}
