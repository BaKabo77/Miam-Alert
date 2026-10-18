import { ThrottlerModuleOptions } from '@nestjs/throttler';

// Limite générale : 100 requêtes par minute et par IP. Largement assez pour un usage normal
// de l'application, mais bloquant pour un script qui enchaîne les requêtes.
// Les routes sensibles (/auth/*) auront une limite plus stricte via @Throttle().
export const throttlerOptions: ThrottlerModuleOptions = [
  { name: 'default', ttl: 60_000, limit: 100 },
];
