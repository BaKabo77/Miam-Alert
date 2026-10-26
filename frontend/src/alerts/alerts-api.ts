import { apiRequest } from '../lib/api';

// L'alerte du jour telle que l'API la renvoie (voir AlertResponse côté backend).
export interface Alert {
  id: string;
  date: string;
  expiredCount: number;
  urgentCount: number;
  read: boolean;
}

export async function fetchTodayAlert(householdId: string): Promise<Alert | null> {
  const { alert } = await apiRequest<{ alert: Alert | null }>(
    `/households/${encodeURIComponent(householdId)}/alerts/today`,
  );
  return alert;
}

export function markAlertAsRead(alertId: string): Promise<void> {
  return apiRequest<void>(`/alerts/${encodeURIComponent(alertId)}/read`, { method: 'POST' });
}
