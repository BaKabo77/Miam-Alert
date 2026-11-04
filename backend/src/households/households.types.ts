import type { HouseholdRole } from '../generated/prisma/client.js';

export interface HouseholdMemberResponse {
  userId: string;
  // Prénom et nom, ou l'email s'ils ne sont pas renseignés (voir member-name.ts).
  displayName: string;
  role: HouseholdRole;
  joinedAt: string;
  isMe: boolean;
}

export interface HouseholdResponse {
  id: string;
  name: string;
  // Rôle de l'utilisateur connecté dans ce foyer.
  role: HouseholdRole;
  members: HouseholdMemberResponse[];
  maxMembers: number;
}

export interface InvitationResponse {
  id: string;
  createdAt: string;
  expiresAt: string;
}

// Seule réponse qui contient le lien : il n'est montré qu'une fois, à sa création.
export interface CreatedInvitationResponse extends InvitationResponse {
  url: string;
}

export interface InvitationPreviewResponse {
  householdName: string;
  // Prénom de la personne qui invite, s'il est renseigné (jamais son email : celui qui tient le
  // lien n'est pas encore membre).
  invitedBy: string | null;
  alreadyMember: boolean;
}

export interface AcceptedInvitationResponse {
  householdId: string;
}
