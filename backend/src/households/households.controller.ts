import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RenameHouseholdDto } from './dto/rename-household.dto.js';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto.js';
import { HouseholdRoleGuard, RequireHouseholdRole } from './household-role.guard.js';
import { HouseholdsService } from './households.service.js';
import type { CreatedInvitationResponse, HouseholdResponse, InvitationResponse } from './households.types.js';

// Routes protégées (aucune n'est @Public()) : access token obligatoire.
// - Membres du foyer : le service vérifie l'appartenance (404 pour le foyer d'un autre).
// - Propriétaire (OWNER) : @RequireHouseholdRole, vérifié par HouseholdRoleGuard (404 pour un
//   non-membre, 403 pour un membre qui n'est pas propriétaire).
@Controller('households/:householdId')
@UseGuards(HouseholdRoleGuard)
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  // Membres : le foyer, ses membres et le rôle de chacun.
  @Get()
  getHousehold(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ): Promise<HouseholdResponse> {
    return this.households.getHousehold(user.id, householdId);
  }

  // Propriétaire : renommer le foyer.
  @Patch()
  @RequireHouseholdRole('OWNER')
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: RenameHouseholdDto,
  ): Promise<HouseholdResponse> {
    return this.households.rename(user.id, householdId, dto.name);
  }

  // Propriétaire : créer un lien d'invitation (usage unique, 7 jours). Le lien n'est renvoyé qu'ici.
  @Post('invitations')
  @RequireHouseholdRole('OWNER')
  createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ): Promise<CreatedInvitationResponse> {
    return this.households.createInvitation(user.id, householdId);
  }

  // Propriétaire : invitations encore utilisables (sans leur lien, qui n'est pas conservé).
  @Get('invitations')
  @RequireHouseholdRole('OWNER')
  listInvitations(@Param('householdId', ParseUUIDPipe) householdId: string): Promise<InvitationResponse[]> {
    return this.households.listInvitations(householdId);
  }

  // Propriétaire : retirer une invitation de CE foyer (celle d'un autre foyer est introuvable).
  @Delete('invitations/:invitationId')
  @RequireHouseholdRole('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.households.revokeInvitation(user.id, householdId, invitationId);
  }

  // Membres : son propre identifiant = quitter le foyer ; celui d'un autre = le retirer, réservé au
  // propriétaire. Le service décide selon la cible, sous verrou (pas de @RequireHouseholdRole ici).
  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ): Promise<void> {
    return this.households.removeMember(user.id, householdId, targetUserId);
  }

  // Propriétaire : donner la propriété à un autre membre (l'ancien propriétaire devient membre).
  @Post('ownership')
  @RequireHouseholdRole('OWNER')
  @HttpCode(HttpStatus.OK)
  transferOwnership(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: TransferOwnershipDto,
  ): Promise<HouseholdResponse> {
    return this.households.transferOwnership(user.id, householdId, dto.userId);
  }
}
