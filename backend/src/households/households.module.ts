import { Module } from '@nestjs/common';
import { HouseholdAccessService } from './household-access.service.js';

@Module({
  providers: [HouseholdAccessService],
  // Exporté : tous les modules qui manipulent des données d'un foyer (pantry, plus tard
  // products, recipes...) utilisent ce même contrôle, plutôt que de le réécrire chacun.
  exports: [HouseholdAccessService],
})
export class HouseholdsModule {}
