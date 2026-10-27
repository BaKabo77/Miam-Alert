import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS } from '../auth/refresh-token.js';
import { AUTH_THROTTLE, EXPORT_THROTTLE } from '../common/throttling.js';
import { DeleteMeDto } from './dto/delete-me.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UsersService } from './users.service.js';
import type { DataExport, MeResponse } from './users.types.js';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Protégée (pas de @Public()) : exige un access token valide.
  // Aucun paramètre d'id : on ne peut consulter que son propre profil.
  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.users.getMe(user.id);
  }

  // Protégée : chacun ne peut exporter que SES données (identité lue dans le token, aucun id en
  // paramètre). Téléchargement d'un fichier JSON.
  @Get('export')
  @Throttle(EXPORT_THROTTLE)
  async exportMe(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DataExport> {
    const data = await this.users.exportData(user.id);
    // no-store : des données personnelles ne doivent rester dans aucun cache (navigateur, proxy).
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="miam-alert-export-${data.exportedAt.slice(0, 10)}.json"`,
    );
    return data;
  }

  // Protégée : l'utilisateur ne peut modifier que SON profil (identité lue dans le token).
  @Patch()
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto): Promise<MeResponse> {
    return this.users.updateMe(user.id, dto);
  }

  // Protégée : on ne peut supprimer que SON compte (identité lue dans le token), et seulement
  // en redonnant son mot de passe. Même limite que /auth/* (10/min) : la route vérifie un mot de
  // passe, elle ne doit pas servir à en deviner un.
  @Delete()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteMeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteMe(user.id, dto.password);
    // Les sessions sont déjà supprimées en base ; on efface aussi le cookie devenu inutile.
    res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS);
  }
}
