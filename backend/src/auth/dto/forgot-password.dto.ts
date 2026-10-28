import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  // Même normalisation qu'à l'inscription : l'adresse est stockée en minuscules.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;
}
