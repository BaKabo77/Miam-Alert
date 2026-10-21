import { ValidateIf } from 'class-validator';

// Comme @IsOptional(), mais seul un champ ABSENT est ignoré : null est validé, donc rejeté.
// @IsOptional() laisserait passer { "name": null } jusqu'à Prisma, qui le refuserait avec
// une erreur 500 au lieu d'un 400 clair.
export const IsOptionalNotNull = () => ValidateIf((_object, value) => value !== undefined);
