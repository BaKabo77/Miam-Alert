import { Logger } from '@nestjs/common';

const logger = new Logger('Heartbeat');
const TIMEOUT_MS = 10_000;

// Signale le résultat d'une tâche planifiée à un service de surveillance (type healthchecks.io).
// Le service attend un signal à heure fixe : s'il ne le reçoit pas (application arrêtée, tâche
// bloquée) ou s'il reçoit "/fail", il prévient l'administrateur. Une tâche planifiée qui échoue
// en silence est l'un des pièges classiques de l'exploitation.
export async function sendHeartbeat(url: string | undefined, outcome: 'success' | 'fail'): Promise<void> {
  if (!url) {
    return;
  }
  try {
    await fetch(outcome === 'fail' ? `${url}/fail` : url, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Aucune redirection suivie : le signal part vers l'adresse configurée, et nulle part ailleurs.
      redirect: 'error',
    });
  } catch (error) {
    // La surveillance ne doit jamais faire échouer la tâche surveillée. L'URL n'est pas
    // journalisée : elle contient l'identifiant secret du contrôle.
    logger.warn(`Heartbeat not sent: ${error instanceof Error ? error.name : 'unknown error'}`);
  }
}
