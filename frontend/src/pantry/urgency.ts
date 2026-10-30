import type { PantryItem } from './pantry-api';

// Un style par niveau d'urgence, partagé par l'inventaire et les recettes. Record<…> oblige TypeScript
// à vérifier qu'aucun niveau n'est oublié : si l'API en ajoute un, le code ne compilera plus tant
// qu'il n'est pas traité ici.
export const URGENCY_STYLES: Record<PantryItem['urgency'], { label: string; colors: string }> = {
  EXPIRED: { label: 'Périmé', colors: 'bg-tomato-100 text-tomato-700' },
  PAST_BEST_BEFORE: { label: 'Date dépassée', colors: 'bg-peach-100 text-peach-800' },
  URGENT: { label: 'À consommer vite', colors: 'bg-peach-100 text-peach-800' },
  SOON: { label: 'Cette semaine', colors: 'bg-sun-100 text-sun-800' },
  OK: { label: 'OK', colors: 'bg-mint-100 text-mint-800' },
};

export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < -1) return `Dépassée de ${-daysLeft} jours`;
  if (daysLeft === -1) return 'Dépassée depuis hier';
  if (daysLeft === 0) return "Aujourd'hui";
  if (daysLeft === 1) return 'Demain';
  return `Dans ${daysLeft} jours`;
}
