import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsersService } from './users.service.js';
import type { MeResponse } from './users.types.js';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Protégée (pas de @Public()) : exige un access token valide.
  // Aucun paramètre d'id : on ne peut consulter que son propre profil.
  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.users.getMe(user.id);
  }
}