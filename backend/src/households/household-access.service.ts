import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SecurityLogger } from '../common/security-logger.js';
import type { HouseholdRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HouseholdAccessService {
  private readonly security = new SecurityLogger();

  constructor(private readonly prisma: PrismaService) {}

  // Point de contrôle unique de l'appartenance à un foyer, appelé avant tout accès
  // à une ressource d'un foyer désigné dans l'URL (protection contre les IDOR).
  // Renvoie le rôle de l'utilisateur dans ce foyer.
  async assertMember(userId: string, householdId: string): Promise<HouseholdRole> {
    const membership = await this.prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId } },
      select: { role: true },
    });

    if (!membership) {
      // Tentative d'accès au foyer d'un autre : tracée, c'est le signe d'un parcours d'identifiants.
      this.security.warn('household.access_denied', { userId });
      // 404 et non 403 : un 403 confirmerait que ce foyer existe.
      throw new NotFoundException('Household not found');
    }
    return membership.role;
  }

  // Appartenance ET rôle exigé (par exemple OWNER pour inviter ou retirer un membre).
  // Non-membre : 404, comme partout. Membre sans le rôle : 403, car il sait déjà que le foyer
  // existe ; le refus est tracé.
  async assertRole(userId: string, householdId: string, required: HouseholdRole): Promise<void> {
    const role = await this.assertMember(userId, householdId);
    if (role !== required) {
      this.security.warn('household.role_denied', { userId });
      throw new ForbiddenException('Only the household owner can do this');
    }
  }
}
