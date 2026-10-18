import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Seule façon d'ouvrir une route sans authentification : chaque exception est visible
// dans le code et doit être justifiée.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
