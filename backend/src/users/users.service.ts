import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MeResponse } from './users.types.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Champs choisis un par un : rien d'autre ne peut sortir, même si le modèle s'enrichit.
      select: {
        id: true,
        email: true,
        memberships: {
          select: { role: true, household: { select: { id: true, name: true } } },
        },
      },
    });

    // Compte supprimé alors que son access token est encore valide (15 min max) : refusé.
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      households: user.memberships.map(({ role, household }) => ({ ...household, role })),
    };
  }
}
