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