import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyPassword } from '../auth/password.js';
import { SecurityLogger } from '../common/security-logger.js';
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
  private readonly security = new SecurityLogger();

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

  // Suppression réelle du compte (RGPD, droit à l'effacement) : compte, sessions, appartenances,
  // et les foyers dont il est le seul membre, avec leur inventaire et leurs alertes.
  async deleteMe(userId: string, password: string): Promise<void> {
    // Lecture explicite du hash : il est exclu par défaut de toutes les requêtes.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    // 403 et non 401 : la session est valide, c'est la confirmation qui est refusée. Un 401
    // ferait croire au front que la session a expiré et le déconnecterait.
    if (!(await verifyPassword(user.passwordHash, password))) {
      this.security.warn('account.delete.denied', { userId });
      throw new ForbiddenException('Invalid password');
    }

    await this.prisma.$transaction(async (tx) => {
      // Supprimer l'utilisateur ne supprime que ses appartenances (cascade), pas les foyers :
      // sans cette étape, l'inventaire resterait en base, orphelin. Un foyer partagé (V2) est
      // conservé pour ses autres membres.
      const soleHouseholds = await tx.household.findMany({
        where: { members: { some: { userId }, every: { userId } } },
        select: { id: true },
      });
      // Cascade : articles et alertes de ces foyers.
      await tx.household.deleteMany({ where: { id: { in: soleHouseholds.map(({ id }) => id) } } });
      // Cascade : sessions (refresh tokens) et appartenances restantes.
      await tx.user.delete({ where: { id: userId } });
    });

    this.security.log('account.deleted', { userId });
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
