import type { ExpiryType } from '../generated/prisma/client.js';
import { computeUrgency } from '../pantry/urgency.js';

export interface AlertSummary {
  expiredCount: number;
  urgentCount: number;
}

// Résumé de l'inventaire d'un foyer pour l'alerte du jour. Réutilise exactement le calcul
// d'urgence de l'inventaire : l'alerte et les badges de l'application sont toujours d'accord.
export function summarizeForAlert(
  items: { expiryDate: Date; expiryType: ExpiryType }[],
  today: Date,
): AlertSummary {
  let expiredCount = 0;
  let urgentCount = 0;

  for (const item of items) {
    const urgency = computeUrgency(item.expiryDate, item.expiryType, today);
    if (urgency === 'EXPIRED') {
      expiredCount++;
    } else if (urgency === 'URGENT' || urgency === 'PAST_BEST_BEFORE') {
      urgentCount++;
    }
  }

  return { expiredCount, urgentCount };
}

// Une alerte n'a de sens que s'il y a quelque chose à faire : pas d'alerte « tout va bien ».
export function needsAlert(summary: AlertSummary): boolean {
  return summary.expiredCount + summary.urgentCount > 0;
}
