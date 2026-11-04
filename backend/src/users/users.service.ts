import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyPassword } from '../auth/password.js';
import { SecurityLogger } from '../common/security-logger.js';
import { Prisma } from '../generated/prisma/client.js';
import { memberDisplayName } from '../households/member-name.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { TERMS_VERSION } from './terms.js';
import type { DataExport, MeResponse } from './users.types.js';

// Champs choisis un par un : rien d'autre ne peut sortir, même si le modèle s'enrichit.
const ME_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  emailVerifiedAt: true,
  termsVersion: true,
  // Ordre d'arrivée : le foyer créé à l'inscription d'abord, puis ceux rejoints.
  memberships: {
    select: {
      role: true,
      household: {
        select: {
          id: true,
          name: true,
          members: {
            where: { role: 'OWNER' },
            select: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  },
} satisfies Prisma.UserSelect;

type MeRow = Prisma.UserGetPayload<{ select: typeof ME_SELECT }>;

// Tout ce qui est rattaché au compte, champ par champ : un champ ajouté plus tard au modèle
// n'apparaîtra dans l'export que si on l'ajoute ici, en connaissance de cause.
const EXPORT_SELECT = {
  email: true,
  firstName: true,
  lastName: true,
  emailVerifiedAt: true,
  termsVersion: true,
  termsAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
  memberships: {
    select: {
      role: true,
      joinedAt: true,
      household: {
        select: {
          name: true,
          pantryItems: {
            select: {
              name: true,
              quantity: true,
              unit: true,
              expiryDate: true,
              expiryType: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              product: { select: { barcode: true, name: true, brand: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          alerts: {
            select: { date: true, expiredCount: true, urgentCount: true, readAt: true },
            orderBy: { date: 'asc' },
          },
        },
      },
    },
  },
  invitationsSent: {
    select: { createdAt: true, expiresAt: true, usedAt: true },
    orderBy: { createdAt: 'asc' },
  },
  refreshTokens: {
    select: { familyId: true, createdAt: true, expiresAt: true, revokedAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.UserSelect;

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

  // Export complet, sans pagination : c'est l'exception assumée à la règle des listes paginées
  // (le droit d'accès porte sur TOUTES les données). Le volume reste celui d'un seul foyer, et la
  // route est limitée en fréquence.
  async exportData(userId: string): Promise<DataExport> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: EXPORT_SELECT });
    if (!user) {
      throw new UnauthorizedException();
    }
    this.security.log('account.exported', { userId });

    return {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        termsVersion: user.termsVersion,
        termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      households: user.memberships.map(({ role, joinedAt, household }) => ({
        name: household.name,
        role,
        joinedAt: joinedAt.toISOString(),
        pantryItems: household.pantryItems.map((item) => ({
          ...item,
          expiryDate: toDay(item.expiryDate),
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        alerts: household.alerts.map((alert) => ({
          ...alert,
          date: toDay(alert.date),
          readAt: alert.readAt?.toISOString() ?? null,
        })),
      })),
      invitationsSent: user.invitationsSent.map((invitation) => ({
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        usedAt: invitation.usedAt?.toISOString() ?? null,
      })),
      sessions: toSessions(user.refreshTokens),
    };
  }

  // Acceptation de la version en vigueur des CGU (version vérifiée par le DTO). Enregistre la preuve :
  // quelle version, et quand.
  async acceptTerms(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() },
        select: { id: true },
      });
    } catch (error) {
      // P2025 : le compte n'existe plus (supprimé, token encore valide).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UnauthorizedException();
      }
      throw error;
    }
    this.security.log('account.terms_accepted', { userId });
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
      // Cascade : articles, alertes et invitations de ces foyers.
      await tx.household.deleteMany({ where: { id: { in: soleHouseholds.map(({ id }) => id) } } });

      // Foyers partagés dont il est propriétaire : la propriété passe au membre le plus ancien, pour
      // qu'un foyer ait toujours un propriétaire (sinon plus personne ne pourrait inviter ni gérer).
      const ownedShared = await tx.householdMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { householdId: true },
      });
      for (const { householdId } of ownedShared) {
        const successor = await tx.householdMember.findFirst({
          where: { householdId, userId: { not: userId } },
          orderBy: { joinedAt: 'asc' },
          select: { userId: true },
        });
        if (successor) {
          await tx.householdMember.update({
            where: { userId_householdId: { userId: successor.userId, householdId } },
            data: { role: 'OWNER' },
          });
        }
      }
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
    emailVerified: user.emailVerifiedAt !== null,
    termsAccepted: user.termsVersion === TERMS_VERSION,
    households: user.memberships.map(({ role, household }) => {
      const owner = household.members[0]?.user;
      return { id: household.id, name: household.name, role, ownerName: owner ? memberDisplayName(owner) : null };
    }),
  };
}

// Dates sans heure (péremption, jour d'une alerte) : "2026-10-27" plutôt qu'un horodatage à minuit UTC.
function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Regroupe les jetons par connexion (famille) : les jetons arrivent triés par date, le dernier de
// chaque famille dit si la session est encore utilisable. familyId reste interne, il n'est pas exporté.
function toSessions(
  tokens: { familyId: string; createdAt: Date; expiresAt: Date; revokedAt: Date | null }[],
): DataExport['sessions'] {
  const families = new Map<string, typeof tokens>();
  for (const token of tokens) {
    families.set(token.familyId, [...(families.get(token.familyId) ?? []), token]);
  }
  const now = new Date();
  return [...families.values()].map((family) => {
    const latest = family[family.length - 1];
    return {
      startedAt: family[0].createdAt.toISOString(),
      lastRenewedAt: latest.createdAt.toISOString(),
      expiresAt: latest.expiresAt.toISOString(),
      active: latest.revokedAt === null && latest.expiresAt > now,
    };
  });
}
