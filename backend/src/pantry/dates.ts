// Les dates de péremption sont des dates sans heure, échangées au format "YYYY-MM-DD"
// et stockées à minuit UTC : pas de décalage selon le fuseau horaire du serveur.
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
