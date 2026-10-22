import type { Prisma } from '../generated/prisma/client.js';
import { formatDateOnly } from './dates.js';
import type { PantryItemResponse } from './pantry.types.js';
import { computeUrgency, daysUntil } from './urgency.js';

// Colonnes lues en base pour un article : on ne charge que ce qui sera renvoyé.
export const PANTRY_ITEM_SELECT = {
  id: true,
  name: true,
  quantity: true,
  unit: true,
  expiryDate: true,
  expiryType: true,
  status: true,
  product: {
    select: { id: true, barcode: true, brand: true, imageUrl: true, nutriscore: true },
  },
} satisfies Prisma.PantryItemSelect;

type PantryItemRow = Prisma.PantryItemGetPayload<{ select: typeof PANTRY_ITEM_SELECT }>;

export function toPantryItemResponse(item: PantryItemRow, today: Date): PantryItemResponse {
  return {
    ...item,
    expiryDate: formatDateOnly(item.expiryDate),
    daysLeft: daysUntil(item.expiryDate, today),
    urgency: computeUrgency(item.expiryDate, item.expiryType, today),
  };
}
