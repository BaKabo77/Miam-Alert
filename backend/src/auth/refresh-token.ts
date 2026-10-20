import { createHash, randomBytes } from 'node:crypto';

// Durée de vie d'une session sans activité : au-delà, il faut se reconnecter.
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// 32 octets aléatoires issus du générateur cryptographique du système (256 bits) :
// impossible à deviner. Ce n'est pas un JWT : il ne contient rien, c'est une simple clé.
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

// En base, on ne stocke que l'empreinte SHA-256 du token : une fuite de la base ne donne
// aucune session utilisable. SHA-256 suffit ici (contrairement aux mots de passe) car le
// token est totalement aléatoire, et le hash doit être déterministe pour le retrouver en base.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Format exact d'un refresh token émis par generateRefreshToken (32 octets en base64url).
// Tout autre contenu de cookie est rejeté sans même interroger la base.
export const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
