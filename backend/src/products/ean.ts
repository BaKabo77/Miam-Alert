import { BadRequestException, PipeTransform } from '@nestjs/common';

// EAN-8 ou EAN-13 : uniquement des chiffres, longueur exacte.
const EAN_PATTERN = /^(\d{8}|\d{13})$/;

// Vérifie le format ET la clé de contrôle (dernier chiffre). Les autres chiffres sont
// pondérés 3, 1, 3, 1... en partant de la droite ; la clé complète la somme au multiple de 10.
// Un code mal scanné ou inventé est ainsi rejeté sans appeler de service externe.
export function isValidEan(code: string): boolean {
  if (!EAN_PATTERN.test(code)) {
    return false;
  }

  const digits = code.split('').map(Number);
  const checkDigit = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === checkDigit;
}

// Pipe de paramètre de route : 400 si le code-barres est invalide, avant toute autre opération.
export class ParseEanPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidEan(value)) {
      throw new BadRequestException('Invalid barcode');
    }
    return value;
  }
}
