import type {
  ExpiryType,
  HouseholdRole,
  PantryItemStatus,
  QuantityUnit,
} from '../generated/prisma/client.js';

export interface MeResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  households: { id: string; name: string; role: HouseholdRole }[];
}

// Export des données personnelles (RGPD, droit d'accès et portabilité) : tout ce que l'application
// conserve sur l'utilisateur, dans un format lisible par une personne comme par une machine.
// Volontairement absents : le hash du mot de passe, les empreintes des jetons et les identifiants
// internes, qui ne sont d'aucune utilité à l'utilisateur et serviraient seulement un attaquant.
export interface DataExport {
  exportedAt: string;
  account: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: string;
    updatedAt: string;
  };
  households: {
    name: string;
    role: HouseholdRole;
    joinedAt: string;
    pantryItems: {
      name: string;
      quantity: number;
      unit: QuantityUnit;
      expiryDate: string;
      expiryType: ExpiryType;
      status: PantryItemStatus;
      createdAt: string;
      updatedAt: string;
      product: { barcode: string; name: string; brand: string | null } | null;
    }[];
    alerts: { date: string; expiredCount: number; urgentCount: number; readAt: string | null }[];
  }[];
  sessions: { createdAt: string; expiresAt: string; revokedAt: string | null }[];
}
