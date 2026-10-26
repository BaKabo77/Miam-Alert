import { Module } from '@nestjs/common';
import { AlertsScheduler } from './alerts.scheduler.js';
import { AlertsService } from './alerts.service.js';

@Module({
  providers: [AlertsService, AlertsScheduler],
})
export class AlertsModule {}
