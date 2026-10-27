import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  // L'ancien mot de passe prouve que c'est bien le titulaire du compte, et pas quelqu'un qui
  // utilise une session restée ouverte ou un access token volé.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  // Mêmes règles qu'à l'inscription : 12 caractères minimum plutôt que des règles de complexité.
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword: string;
}
