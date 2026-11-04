import { apiRequest } from '../lib/api';

// Réponses de l'API des foyers (voir households.types.ts côté backend).
export type HouseholdRole = 'OWNER' | 'MEMBER';

export interface HouseholdMember {
  userId: string;
  // Prénom et nom, ou l'email s'ils ne sont pas renseignés (choix de l'API).
  displayName: string;
  role: HouseholdRole;
  joinedAt: string;
  isMe: boolean;
}

export interface Household {
  id: string;
  name: string;
  role: HouseholdRole;
  members: HouseholdMember[];
  maxMembers: number;
}

export interface Invitation {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface InvitationPreview {
  householdName: string;
  invitedBy: string | null;
  alreadyMember: boolean;
}

const householdPath = (householdId: string) => `/households/${encodeURIComponent(householdId)}`;

export function fetchHousehold(householdId: string): Promise<Household> {
  return apiRequest<Household>(householdPath(householdId));
}

export function renameHousehold(householdId: string, name: string): Promise<Household> {
  return apiRequest<Household>(householdPath(householdId), { method: 'PATCH', body: { name } });
}

// Le lien (url) n'est renvoyé qu'ici : l'API n'en garde que l'empreinte.
export function createInvitation(householdId: string): Promise<Invitation & { url: string }> {
  return apiRequest(`${householdPath(householdId)}/invitations`, { method: 'POST' });
}

export function fetchInvitations(householdId: string): Promise<Invitation[]> {
  return apiRequest<Invitation[]>(`${householdPath(householdId)}/invitations`);
}

export function revokeInvitation(householdId: string, invitationId: string): Promise<void> {
  return apiRequest<void>(`${householdPath(householdId)}/invitations/${encodeURIComponent(invitationId)}`, {
    method: 'DELETE',
  });
}

// Son propre identifiant : quitter le foyer. Celui d'un autre : le retirer (propriétaire).
export function removeMember(householdId: string, userId: string): Promise<void> {
  return apiRequest<void>(`${householdPath(householdId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function transferOwnership(householdId: string, userId: string): Promise<Household> {
  return apiRequest<Household>(`${householdPath(householdId)}/ownership`, { method: 'POST', body: { userId } });
}

// Le jeton part dans le corps d'un POST, jamais dans l'URL d'une requête.
export function previewInvitation(token: string): Promise<InvitationPreview> {
  return apiRequest<InvitationPreview>('/household-invitations/preview', { method: 'POST', body: { token } });
}

export function acceptInvitation(token: string): Promise<{ householdId: string }> {
  return apiRequest<{ householdId: string }>('/household-invitations/accept', { method: 'POST', body: { token } });
}
