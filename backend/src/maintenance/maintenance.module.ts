import { Module } from '@nestjs/common';
import { PurgeScheduler } from './purge.scheduler.js';
import { PurgeService } from './purge.service.js';

// Tâches d'entretien de la base (purge des données devenues inutiles).
@Module({
  providers: [PurgeService, PurgeScheduler],
})
export class MaintenanceModule {}
