import type { ExpiryType } from '../generated/prisma/client.js';

export type Urgency = 'EXPIRED' | 'PAST_BEST_BEFORE' | 'URGENT' | 'SOON' | 'OK';

export const URGENT_WITHIN_DAYS = 2;
export const SOON_WITHIN_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Jours restants avant la date (négatif si elle est dépassée). Les deux dates sont à
// minuit UTC : la différence est un nombre entier de jours.
export function daysUntil(expiryDate: Date, today: Date): number {
  return Math.round((expiryDate.getTime() - today.getTime()) / MS_PER_DAY);
}

export function computeUrgency(expiryDate: Date, expiryType: ExpiryType, today: Date): Urgency {
  const daysLeft = daysUntil(expiryDate, today);

  if (daysLeft < 0) {
    // DLC dépassée : à jeter (risque sanitaire). DDM dépassée : encore consommable.
    return expiryType === 'DLC' ? 'EXPIRED' : 'PAST_BEST_BEFORE';
  }
  if (daysLeft <= URGENT_WITHIN_DAYS) {
    return 'URGENT';
  }
  if (daysLeft <= SOON_WITHIN_DAYS) {
    return 'SOON';
  }
  return 'OK';
}
