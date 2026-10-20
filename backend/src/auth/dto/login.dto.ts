import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  // Même normalisation qu'à l'inscription, sinon "Marie@..." ne retrouverait pas son compte.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  // Pas de longueur minimale ici : on ne révèle pas la politique de mot de passe,
  // un mot de passe trop court est simplement un mauvais mot de passe.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
