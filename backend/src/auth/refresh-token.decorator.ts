import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { parseCookie } from 'cookie';
import type { Request } from 'express';
import { REFRESH_TOKEN_COOKIE } from './refresh-token.js';

// Lit le refresh token dans le cookie, uniquement sur les routes qui en ont besoin
// (pas de parseur de cookies global : les autres routes n'ont aucune raison de les lire).
export const RefreshTokenCookie = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const header = ctx.switchToHttp().getRequest<Request>().headers.cookie;
    return header ? parseCookie(header)[REFRESH_TOKEN_COOKIE] : undefined;
  },
);
