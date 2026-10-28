import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PurgeService } from './purge.service.js';

@Injectable()
export class PurgeScheduler {
  private readonly logger = new Logger(PurgeScheduler.name);

  constructor(private readonly purge: PurgeService) {}

  // Chaque nuit à 4 h (Paris), APRÈS la sauvegarde de 3 h : une donnée supprimée par erreur
  // resterait récupérable dans les sauvegardes des jours précédents.
  @Cron('0 4 * * *', { name: 'data-purge', timeZone: 'Europe/Paris' })
  async run(): Promise<void> {
    try {
      await this.purge.purgeExpiredData();
    } catch (error) {
      // Un échec ne doit pas arrêter l'application ; la purge du lendemain rattrapera.
      this.logger.error('Data purge failed', error instanceof Error ? error.stack : String(error));
    }
  }
}
