import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import type { MeResponse } from './users.types.js';

// Champs choisis un par un : rien d'autre ne peut sortir, même si le modèle s'enrichit.
const ME_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  memberships: {
    select: { role: true, household: { select: { id: true, name: true } } },
  },
} satisfies Prisma.UserSelect;

type MeRow = Prisma.UserGetPayload<{ select: typeof ME_SELECT }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: ME_SELECT });

    // Compte supprimé alors que son access token est encore valide (15 min max) : refusé.
    if (!user) {
      throw new UnauthorizedException();
    }
    return toMeResponse(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeResponse> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        // undefined : champ inchangé ; null : champ effacé.
        data: { firstName: dto.firstName, lastName: dto.lastName },
        select: ME_SELECT,
      });
      return toMeResponse(user);
    } catch (error) {
      // P2025 : le compte n'existe plus (supprimé, token encore valide) → même réponse que getMe.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UnauthorizedException();
      }
      throw error;
    }
  }
}

function toMeResponse(user: MeRow): MeResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    households: user.memberships.map(({ role, household }) => ({ ...household, role })),
  };
}
