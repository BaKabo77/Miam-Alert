import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Supprimer son compte est irréversible : le mot de passe est redemandé, même avec une session
// valide. Un access token volé, ou un appareil resté connecté, ne suffit pas à tout effacer.
export class DeleteMeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
