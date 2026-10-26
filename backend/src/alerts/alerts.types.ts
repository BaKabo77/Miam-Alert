// Ce qui sort de l'API pour une alerte : ni householdId, ni dates techniques.
export interface AlertResponse {
  id: string;
  date: string; // "2026-10-26"
  expiredCount: number;
  urgentCount: number;
  read: boolean;
}

// Enveloppe : "pas d'alerte aujourd'hui" est une réponse normale (alert: null), pas une erreur.
export interface TodayAlertResponse {
  alert: AlertResponse | null;
}
