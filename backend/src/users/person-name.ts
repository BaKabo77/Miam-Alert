import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export const PERSON_NAME_MAX_LENGTH = 100;

// Une lettre (de n'importe quelle langue, accents compris), puis lettres, espaces, apostrophes,
// traits d'union ou points : "Jean-Pierre", "N'Diaye", "Ève Le Gall".
// Pas de chiffre, de balise HTML ni de caractère de contrôle : un nom n'en contient pas, et ces
// caractères n'ont rien à faire dans une donnée affichée ailleurs (défense en profondeur).
const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.-]*$/u;

// Espaces superflus retirés. Un champ laissé vide vaut "rien" : absent à l'inscription,
// effacement (null) à la modification du profil.
const normalize =
  (blankValue: undefined | null) =>
  ({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const cleaned = value.trim().replace(/\s+/g, ' ');
    return cleaned === '' ? blankValue : cleaned;
  };

const nameRules = [
  IsString(),
  MaxLength(PERSON_NAME_MAX_LENGTH),
  Matches(PERSON_NAME_PATTERN, { message: '$property contains forbidden characters' }),
];

// Inscription : facultatif. Absent ou vide → non enregistré ; null → refusé (400).
export function IsOptionalPersonName() {
  return applyDecorators(
    Transform(normalize(undefined)),
    ValidateIf((_object, value) => value !== undefined),
    ...nameRules,
  );
}

// Modification du profil : absent → inchangé ; null ou vide → effacé (droit de rectification).
export function IsNullablePersonName() {
  return applyDecorators(
    Transform(normalize(null)),
    ValidateIf((_object, value) => value !== undefined && value !== null),
    ...nameRules,
  );
}
