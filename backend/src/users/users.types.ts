import type { HouseholdRole } from '../generated/prisma/client.js';

export interface MeResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  households: { id: string; name: string; role: HouseholdRole }[];
}
