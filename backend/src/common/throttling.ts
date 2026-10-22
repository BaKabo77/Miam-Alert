import { ThrottlerModuleOptions } from '@nestjs/throttler';

// Limite générale : 100 requêtes par minute et par IP. Largement assez pour un usage normal
// de l'application, mais bloquant pour un script qui enchaîne les requêtes.
// Les routes sensibles (/auth/*) auront une limite plus stricte via @Throttle().
export const throttlerOptions: ThrottlerModuleOptions = [
  { name: 'default', ttl: 60_000, limit: 100 },
];

// Limite stricte des routes /auth/* : 10 requêtes par minute et par IP.
// Suffisant pour un humain, mais rend le brute force de mots de passe impraticable.
export const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

// Recherche de produit : 30 requêtes par minute et par IP. Largement assez pour scanner
// ses courses, mais empêche d'utiliser notre API pour aspirer le catalogue d'Open Food Facts.
export const PRODUCTS_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
