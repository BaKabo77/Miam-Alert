import { ValidationPipe } from '@nestjs/common';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Supprime tout champ sans décorateur de validation dans le DTO...
    whitelist: true,
    // ...et rejette même la requête (400) : on refuse plutôt que nettoyer en silence,
    // une tentative de mass assignment doit être visible.
    forbidNonWhitelisted: true,
    // Transforme le JSON reçu en instance du DTO (types et valeurs par défaut appliqués).
    transform: true,
    // Pas de conversion de type implicite : "123" ne devient pas 123 sans un @Type() explicite.
    transformOptions: { enableImplicitConversion: false },
  });
}
