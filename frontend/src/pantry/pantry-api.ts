import { apiRequest } from '../lib/api';

// Un article tel que l'API le renvoie (voir PantryItemResponse côté backend).
export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'PIECE' | 'GRAM' | 'MILLILITER';
  expiryDate: string; // "2026-10-25"
  expiryType: 'DLC' | 'DDM';
  status: 'ACTIVE' | 'CONSUMED' | 'WASTED' | 'FROZEN';
  daysLeft: number;
  urgency: 'EXPIRED' | 'PAST_BEST_BEFORE' | 'URGENT' | 'SOON' | 'OK';
  // Fiche produit liée (article scanné), ou null pour une saisie manuelle.
  product: { imageUrl: string | null; nutriscore: string | null } | null;
}

interface PantryPage {
  items: PantryItem[];
  total: number;
}

// L'inventaire actif du foyer, déjà trié par urgence par l'API.
export async function fetchPantryItems(householdId: string): Promise<PantryItem[]> {
  const page = await apiRequest<PantryPage>(
    `/households/${encodeURIComponent(householdId)}/pantry-items?pageSize=100`,
  );
  return page.items;
}

export type PantryItemStatus = PantryItem['status'];

// Ce que l'API accepte pour créer un article (voir CreatePantryItemDto côté backend).
export interface NewPantryItem {
  name: string;
  quantity: number;
  unit: PantryItem['unit'];
  expiryDate: string;
  expiryType: PantryItem['expiryType'];
  productId?: string;
}

export function createPantryItem(householdId: string, item: NewPantryItem): Promise<PantryItem> {
  return apiRequest<PantryItem>(`/households/${encodeURIComponent(householdId)}/pantry-items`, {
    method: 'POST',
    body: item,
  });
}

// Consommé, jeté ou congelé : l'article quitte l'inventaire actif.
export function updatePantryItemStatus(itemId: string, status: PantryItemStatus): Promise<PantryItem> {
  return apiRequest<PantryItem>(`/pantry-items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: { status },
  });
}

