import type { ExpiryType, PantryItemStatus, QuantityUnit } from '../generated/prisma/client.js';
import type { Urgency } from './urgency.js';

// Ce qui sort de l'API pour un article : ni householdId, ni dates techniques.
export interface PantryItemResponse {
  id: string;
  name: string;
  quantity: number;
  unit: QuantityUnit;
  expiryDate: string;
  expiryType: ExpiryType;
  status: PantryItemStatus;
  daysLeft: number;
  urgency: Urgency;
}
