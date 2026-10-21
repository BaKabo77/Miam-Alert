import { Injectable, NotFoundException } from '@nestjs/common';
import { SecurityLogger } from '../common/security-logger.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HouseholdAccessService {
  private readonly security = new SecurityLogger();

  constructor(private readonly prisma: PrismaService) {}

  // Point de contrôle unique de l'appartenance à un foyer, appelé avant tout accès
  // à une ressource d'un foyer désigné dans l'URL (protection contre les IDOR).
  async assertMember(userId: string, householdId: string): Promise<void> {
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
  }
}
