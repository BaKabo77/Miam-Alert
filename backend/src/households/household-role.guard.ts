import { BadRequestException, CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { HouseholdRole } from '../generated/prisma/client.js';
import { HouseholdAccessService } from './household-access.service.js';

const HOUSEHOLD_ROLE_KEY = 'householdRole';

// Réserve une route à un rôle dans le foyer désigné par le paramètre :householdId de l'URL.
// Le contrôle est déclaratif, visible sur la route elle-même (comme @Public()).
export const RequireHouseholdRole = (role: HouseholdRole) => SetMetadata(HOUSEHOLD_ROLE_KEY, role);

// Guard dédié aux rôles du foyer. Il s'exécute après le guard JWT global (l'utilisateur vient du
// token) et AVANT la validation des paramètres : il vérifie donc lui-même le format de l'identifiant.
@Injectable()
export class HouseholdRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: HouseholdAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const role = this.reflector.get<HouseholdRole | undefined>(HOUSEHOLD_ROLE_KEY, context.getHandler());
    if (!role) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    const householdId = request.params.householdId;
    if (typeof householdId !== 'string' || !isUUID(householdId)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }

    await this.access.assertRole(request.user.id, householdId, role);
    return true;
  }
}
