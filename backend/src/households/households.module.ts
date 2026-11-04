import { Module } from '@nestjs/common';
import { HouseholdAccessService } from './household-access.service.js';
import { HouseholdInvitationsController } from './household-invitations.controller.js';
import { HouseholdRoleGuard } from './household-role.guard.js';
import { HouseholdsController } from './households.controller.js';
import { HouseholdsService } from './households.service.js';

@Module({
  controllers: [HouseholdsController, HouseholdInvitationsController],
  providers: [HouseholdAccessService, HouseholdRoleGuard, HouseholdsService],
  // Exporté : tous les modules qui manipulent des données d'un foyer (inventaire, alertes,
  // recettes) utilisent ce même contrôle, plutôt que de le réécrire chacun.
  exports: [HouseholdAccessService],
})
export class HouseholdsModule {}
