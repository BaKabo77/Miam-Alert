import { IsNullablePersonName } from '../person-name.js';

// Seuls le prénom et le nom sont modifiables ici. L'email et le mot de passe auront leurs
// propres routes (avec confirmation) ; tout autre champ envoyé est rejeté (mass assignment).
export class UpdateMeDto {
  @IsNullablePersonName()
  firstName?: string | null;

  @IsNullablePersonName()
  lastName?: string | null;
}
