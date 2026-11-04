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
  emailVerified: boolean;
  // false : les CGU ont changé depuis la dernière acceptation (ou n'ont jamais été acceptées) ;
  // le front demande alors de les accepter avant d'utiliser l'application.
  termsAccepted: boolean;
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
    emailVerifiedAt: string | null;
    termsVersion: string | null;
    termsAcceptedAt: string | null;
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
  // Liens d'invitation créés par l'utilisateur (foyer partagé), sans le lien lui-même (non conservé).
  invitationsSent: { createdAt: string; expiresAt: string; usedAt: string | null }[];
  // Une entrée par connexion (et non par jeton : chaque renouvellement en crée un nouveau).
  sessions: { startedAt: string; lastRenewedAt: string; expiresAt: string; active: boolean }[];
}
