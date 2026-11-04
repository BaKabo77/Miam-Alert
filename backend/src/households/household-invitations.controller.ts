import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AUTH_THROTTLE } from '../common/throttling.js';
import { InvitationTokenDto } from './dto/invitation-token.dto.js';
import { HouseholdsService } from './households.service.js';
import type { AcceptedInvitationResponse, InvitationPreviewResponse } from './households.types.js';

// Routes protégées (pas de @Public()) : tout utilisateur connecté qui détient un lien d'invitation.
// C'est le jeton (aléatoire, haché en base, usage unique, 7 jours) qui ouvre le foyer ; il voyage
// dans le corps (POST), jamais dans l'URL. Limite stricte (10/min par IP) comme /auth.
@Controller('household-invitations')
@Throttle(AUTH_THROTTLE)
export class HouseholdInvitationsController {
  constructor(private readonly households: HouseholdsService) {}

  // Ce que propose l'invitation (nom du foyer, prénom de la personne qui invite), avant d'accepter.
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@CurrentUser() user: AuthenticatedUser, @Body() dto: InvitationTokenDto): Promise<InvitationPreviewResponse> {
    return this.households.previewInvitation(user.id, dto.token);
  }

  // Rejoindre le foyer comme membre.
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: AuthenticatedUser, @Body() dto: InvitationTokenDto): Promise<AcceptedInvitationResponse> {
    return this.households.acceptInvitation(user.id, dto.token);
  }
}
