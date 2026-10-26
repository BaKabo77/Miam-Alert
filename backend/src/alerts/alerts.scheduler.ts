import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertsService } from './alerts.service.js';

// Séparé du service : le calcul se teste en l'appelant directement, sans attendre 7 h du matin.
@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(private readonly alerts: AlertsService) {}

  // Chaque jour à 9 h, heure de Paris (le fuseau gère tout seul le passage à l'heure d'été).
  @Cron('0 9 * * *', { name: 'daily-alerts', timeZone: 'Europe/Paris' })
  async generateDailyAlerts(): Promise<void> {
    try {
      await this.alerts.generateDailyAlerts();
    } catch (error) {
      // Une erreur ne doit pas arrêter l'application : elle est journalisée, et l'exécution du
      // lendemain repartira normalement.
      this.logger.error('Daily alerts generation failed', error instanceof Error ? error.stack : String(error));
    }
  }
}
