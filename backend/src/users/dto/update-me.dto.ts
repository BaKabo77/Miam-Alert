import { IsNullablePersonName } from '../person-name.js';

// Seuls le prénom et le nom sont modifiables ici. Le mot de passe a sa propre route, avec
// confirmation (/auth/change-password) ; tout autre champ envoyé est rejeté (mass assignment).
export class UpdateMeDto {
  @IsNullablePersonName()
  firstName?: string | null;

  @IsNullablePersonName()
  lastName?: string | null;
}
