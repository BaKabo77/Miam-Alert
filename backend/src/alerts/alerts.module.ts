import { Module } from '@nestjs/common';
import { HouseholdsModule } from '../households/households.module.js';
import { AlertsController } from './alerts.controller.js';
import { AlertsScheduler } from './alerts.scheduler.js';
import { AlertsService } from './alerts.service.js';

@Module({
  // HouseholdsModule exporte HouseholdAccessService : même contrôle d'appartenance que l'inventaire.
  imports: [HouseholdsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsScheduler],
})
export class AlertsModule {}
