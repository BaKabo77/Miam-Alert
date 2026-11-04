import { createHash, randomBytes } from 'node:crypto';

// Lien d'invitation : 32 octets aléatoires (256 bits), impossibles à deviner. Seule l'empreinte
// SHA-256 est enregistrée : une fuite de la base ne donne aucun lien utilisable.
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Format exact d'un jeton émis ici : tout autre contenu est rejeté avant d'interroger la base.
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
