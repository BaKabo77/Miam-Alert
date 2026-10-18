import type { Request } from 'express';

// Le token ne contient que l'id de l'utilisateur : un JWT est lisible par n'importe qui
// (il est encodé, pas chiffré), on n'y met donc ni email ni donnée personnelle.
// Le foyer n'y est pas non plus : il est relu en base, pour qu'un retrait du foyer
// prenne effet immédiatement, sans attendre l'expiration du token.
export interface AccessTokenPayload {
  sub: string;
}

export interface AuthenticatedUser {
  id: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
