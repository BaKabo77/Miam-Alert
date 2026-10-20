import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types.js';

// Renvoie l'utilisateur authentifié, tel que le guard JWT l'a extrait du token vérifié.
// C'est la seule source d'identité à utiliser dans les controllers : jamais un id lu dans
// le corps, l'URL ou les paramètres de la requête.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    // Ne peut arriver que si le décorateur est utilisé sur une route @Public() :
    // c'est une erreur de code, on refuse plutôt que de continuer sans identité.
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  },
);
