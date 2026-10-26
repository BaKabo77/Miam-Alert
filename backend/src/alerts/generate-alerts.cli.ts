// Génère les alertes du jour à la demande, sans attendre la tâche de 9 h.
// Utilisation (dans le conteneur) : npm run alerts:generate
//
// Une commande plutôt qu'une route HTTP : seule une personne ayant accès au serveur peut la
// lancer. Sans risque de doublon : la génération est idempotente (une alerte par foyer et par jour).
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AlertsService } from './alerts.service.js';

// Contexte d'application sans serveur HTTP : modules, configuration et base de données seulement.
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });

try {
  const created = await app.get(AlertsService).generateDailyAlerts();
  console.log(`${created} alerte(s) créée(s).`);
} finally {
  await app.close();
}
