// Dates au format de l'API ("YYYY-MM-DD"), calculées dans le fuseau de l'utilisateur :
// "demain" doit être demain pour lui, pas en UTC.

export function todayPlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function todayPlusMonths(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return toDateInputValue(date);
}

// Format attendu par <input type="date"> et par l'API.
function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
