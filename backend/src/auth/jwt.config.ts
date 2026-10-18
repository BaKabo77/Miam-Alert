import { JwtModuleOptions } from '@nestjs/jwt';

// Access token court : s'il est volé, il ne sert que 15 minutes.
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export function buildJwtOptions(secret: string): JwtModuleOptions {
  return {
    secret,
    signOptions: { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    // Algorithme imposé à la vérification : un token qui annonce "alg: none" ou un autre
    // algorithme est rejeté (attaque classique de confusion d'algorithme).
    verifyOptions: { algorithms: ['HS256'] },
  };
}
