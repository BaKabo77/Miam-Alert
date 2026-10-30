import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { sendHeartbeat } from '../common/heartbeat.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { AlertsService } from './alerts.service.js';

// Séparé du service : le calcul se teste en l'appelant directement, sans attendre 9 h du matin.
@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(
    private readonly alerts: AlertsService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // Chaque jour à 9 h, heure de Paris (le fuseau gère tout seul le passage à l'heure d'été).
  @Cron('0 9 * * *', { name: 'daily-alerts', timeZone: 'Europe/Paris' })
  async generateDailyAlerts(): Promise<void> {
    const monitoringUrl = this.config.get('ALERTS_HEALTHCHECK_URL', { infer: true });
    try {
      await this.alerts.generateDailyAlerts();
      await sendHeartbeat(monitoringUrl, 'success');
    } catch (error) {
      await sendHeartbeat(monitoringUrl, 'fail');
      // Une erreur ne doit pas arrêter l'application : elle est journalisée, et l'exécution du
      // lendemain repartira normalement.
      this.logger.error('Daily alerts generation failed', error instanceof Error ? error.stack : String(error));
    }
  }
}
