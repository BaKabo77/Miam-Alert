import type { HouseholdRole } from '../generated/prisma/client.js';

export interface MeResponse {
  id: string;
  email: string;
  households: { id: string; name: string; role: HouseholdRole }[];
}