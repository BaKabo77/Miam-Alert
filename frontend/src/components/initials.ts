// Initiales affichées dans l'avatar : "Marie-Ève" "N'Diaye" → "MN". Vide si aucun nom n'est renseigné.
export function initials(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName]
    .map((name) => name?.trim().charAt(0).toUpperCase() ?? '')
    .join('');
}
