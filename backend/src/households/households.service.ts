import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from '../common/security-logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_HOUSEHOLD_NAME } from './default-household.js';
import { HouseholdAccessService } from './household-access.service.js';
import type {
  AcceptedInvitationResponse,
  CreatedInvitationResponse,
  HouseholdResponse,
  InvitationPreviewResponse,
  InvitationResponse,
} from './households.types.js';
import { generateInvitationToken, hashInvitationToken, INVITATION_TTL_MS } from './invitation-token.js';
import { memberDisplayName } from './member-name.js';

// Un foyer reste un foyer : la limite empêche aussi d'utiliser un « foyer » comme groupe ouvert.
export const MAX_MEMBERS = 8;
// Liens en circulation en même temps : chacun ouvre le foyer à une personne de plus.
export const MAX_ACTIVE_INVITATIONS = 5;

@Injectable()
export class HouseholdsService {
  private readonly security = new SecurityLogger();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HouseholdAccessService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // Membres du foyer uniquement (404 sinon).
  async getHousehold(userId: string, householdId: string): Promise<HouseholdResponse> {
    await this.access.assertMember(userId, householdId);
    return this.loadHousehold(userId, householdId);
  }

  // Propriétaire uniquement (vérifié par HouseholdRoleGuard).
  async rename(userId: string, householdId: string, name: string): Promise<HouseholdResponse> {
    await this.prisma.household.update({ where: { id: householdId }, data: { name }, select: { id: true } });
    this.security.log('household.renamed', { userId });
    return this.loadHousehold(userId, householdId);
  }

  // Propriétaire uniquement. Le lien n'est renvoyé qu'ici, une seule fois : seule son empreinte
  // est conservée, il ne pourra plus être affiché.
  async createInvitation(userId: string, householdId: string): Promise<CreatedInvitationResponse> {
    const token = generateInvitationToken();

    const invitation = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await lockHousehold(tx, householdId);
      if ((await tx.householdMember.count({ where: { householdId } })) >= MAX_MEMBERS) {
        throw new ConflictException('Household is full');
      }
      const active = await tx.householdInvitation.count({ where: activeInvitations(householdId, now) });
      if (active >= MAX_ACTIVE_INVITATIONS) {
        throw new ConflictException('Too many active invitations');
      }
      return tx.householdInvitation.create({
        data: {
          householdId,
          tokenHash: hashInvitationToken(token),
          createdById: userId,
          createdAt: now,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        },
        select: { id: true, createdAt: true, expiresAt: true },
      });
    });

    this.security.log('household.invitation.created', { userId });
    // Jeton dans le fragment (#) : jamais envoyé au serveur du front, absent des journaux d'accès.
    const url = `${this.config.get('APP_URL', { infer: true })}/join#token=${token}`;
    return { ...toInvitationResponse(invitation), url };
  }

  // Propriétaire uniquement : invitations encore utilisables, sans leur lien (il n'est pas conservé).
  async listInvitations(householdId: string): Promise<InvitationResponse[]> {
    const invitations = await this.prisma.householdInvitation.findMany({
      where: activeInvitations(householdId, new Date()),
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return invitations.map(toInvitationResponse);
  }

  // Propriétaire uniquement. Le filtre sur le foyer fait partie de la requête : l'invitation d'un
  // autre foyer est « introuvable », comme une invitation inexistante.
  async revokeInvitation(userId: string, householdId: string, invitationId: string): Promise<void> {
    const { count } = await this.prisma.householdInvitation.deleteMany({
      where: { id: invitationId, householdId, usedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('Invitation not found');
    }
    this.security.log('household.invitation.revoked', { userId });
  }

  // Tout utilisateur connecté qui détient le lien : ce que l'invitation propose, avant d'accepter.
  async previewInvitation(userId: string, token: string): Promise<InvitationPreviewResponse> {
    const invitation = await this.prisma.householdInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: {
        householdId: true,
        expiresAt: true,
        usedAt: true,
        household: { select: { name: true } },
        createdBy: { select: { firstName: true } },
      },
    });
    if (!invitation || !isUsable(invitation, new Date())) {
      throw this.invalidInvitation(userId);
    }

    const membership = await this.prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId: invitation.householdId } },
      select: { role: true },
    });
    return {
      householdName: invitation.household.name,
      invitedBy: invitation.createdBy?.firstName ?? null,
      alreadyMember: membership !== null,
    };
  }

  // Tout utilisateur connecté qui détient le lien : il rejoint le foyer comme MEMBER. Le lien ne
  // sert qu'une fois. Déjà membre : 409, et le lien reste utilisable par la personne invitée.
  async acceptInvitation(userId: string, token: string): Promise<AcceptedInvitationResponse> {
    const tokenHash = hashInvitationToken(token);

    const householdId = await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.householdInvitation.findUnique({
        where: { tokenHash },
        select: { id: true, householdId: true, expiresAt: true, usedAt: true },
      });
      const now = new Date();
      if (!invitation || !isUsable(invitation, now)) {
        return null;
      }

      // Verrou : deux acceptations simultanées passent l'une après l'autre, la limite de membres
      // ne peut pas être dépassée.
      await lockHousehold(tx, invitation.householdId);
      const existing = await tx.householdMember.findUnique({
        where: { userId_householdId: { userId, householdId: invitation.householdId } },
        select: { role: true },
      });
      if (existing) {
        throw new ConflictException('Already a member of this household');
      }
      if ((await tx.householdMember.count({ where: { householdId: invitation.householdId } })) >= MAX_MEMBERS) {
        throw new ConflictException('Household is full');
      }

      // Usage unique : la condition « usedAt: null » fait gagner une seule acceptation.
      const { count } = await tx.householdInvitation.updateMany({
        where: { id: invitation.id, usedAt: null },
        data: { usedAt: now, usedById: userId },
      });
      if (count === 0) {
        return null;
      }
      await tx.householdMember.create({
        data: { userId, householdId: invitation.householdId, role: 'MEMBER', joinedAt: now },
      });
      return invitation.householdId;
    });

    if (!householdId) {
      throw this.invalidInvitation(userId);
    }
    this.security.log('household.invitation.accepted', { userId });
    return { householdId };
  }

  // Retirer un membre (propriétaire uniquement), ou quitter le foyer (soi-même, tout rôle).
  // Règles qui gardent un état cohérent :
  // - un foyer a toujours exactement un propriétaire : il transfère la propriété avant de partir ;
  // - le dernier membre ne part pas (le foyer resterait orphelin, avec son inventaire) ;
  // - chacun garde au moins un foyer (l'application en a besoin pour fonctionner) : qui perd son
  //   dernier foyer en reçoit un nouveau, vide, comme à l'inscription.
  async removeMember(actorId: string, householdId: string, targetUserId: string): Promise<void> {
    const leaving = actorId === targetUserId;

    await this.prisma.$transaction(async (tx) => {
      await lockHousehold(tx, householdId);
      const members = await tx.householdMember.findMany({
        where: { householdId },
        select: { userId: true, role: true },
      });
      const actor = members.find((member) => member.userId === actorId);
      if (!actor) {
        this.security.warn('household.access_denied', { userId: actorId });
        throw new NotFoundException('Household not found');
      }

      if (leaving) {
        if (members.length === 1) {
          throw new ConflictException('The last member cannot leave the household');
        }
        if (actor.role === 'OWNER') {
          throw new ConflictException('Transfer ownership before leaving the household');
        }
      } else {
        if (actor.role !== 'OWNER') {
          this.security.warn('household.role_denied', { userId: actorId });
          throw new ForbiddenException('Only the household owner can do this');
        }
        // Le propriétaire est forcément l'acteur (un seul par foyer) : la cible est donc un MEMBER.
        if (!members.some((member) => member.userId === targetUserId)) {
          throw new NotFoundException('Member not found');
        }
      }

      await tx.householdMember.delete({ where: { userId_householdId: { userId: targetUserId, householdId } } });
      if ((await tx.householdMember.count({ where: { userId: targetUserId } })) === 0) {
        await tx.household.create({
          data: { name: DEFAULT_HOUSEHOLD_NAME, members: { create: { userId: targetUserId, role: 'OWNER' } } },
          select: { id: true },
        });
      }
    });

    this.security.log(leaving ? 'household.member.left' : 'household.member.removed', { userId: actorId });
  }

  // Propriétaire uniquement (vérifié par HouseholdRoleGuard, puis de nouveau sous verrou) : un
  // autre membre devient propriétaire, l'ancien devient membre. Il y a toujours un seul OWNER.
  async transferOwnership(actorId: string, householdId: string, targetUserId: string): Promise<HouseholdResponse> {
    if (actorId === targetUserId) {
      throw new BadRequestException('You already own this household');
    }

    await this.prisma.$transaction(async (tx) => {
      await lockHousehold(tx, householdId);
      const { count } = await tx.householdMember.updateMany({
        where: { householdId, userId: actorId, role: 'OWNER' },
        data: { role: 'MEMBER' },
      });
      if (count === 0) {
        throw new ForbiddenException('Only the household owner can do this');
      }
      const promoted = await tx.householdMember.updateMany({
        where: { householdId, userId: targetUserId },
        data: { role: 'OWNER' },
      });
      // Pas membre : la transaction est annulée, l'ancien propriétaire le reste.
      if (promoted.count === 0) {
        throw new NotFoundException('Member not found');
      }
    });

    this.security.log('household.ownership_transferred', { userId: actorId });
    return this.loadHousehold(actorId, householdId);
  }

  private async loadHousehold(userId: string, householdId: string): Promise<HouseholdResponse> {
    const household = await this.prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: {
        id: true,
        name: true,
        members: {
          select: {
            role: true,
            joinedAt: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    const members = household.members.map(({ role, joinedAt, user }) => ({
      userId: user.id,
      displayName: memberDisplayName(user),
      role,
      joinedAt: joinedAt.toISOString(),
      isMe: user.id === userId,
    }));
    return {
      id: household.id,
      name: household.name,
      role: members.find((member) => member.isMe)?.role ?? 'MEMBER',
      members,
      maxMembers: MAX_MEMBERS,
    };
  }

  // Inconnu, expiré ou déjà utilisé : même réponse, indiscernable pour l'appelant.
  private invalidInvitation(userId: string): BadRequestException {
    this.security.warn('household.invitation.invalid', { userId });
    return new BadRequestException('Invalid or expired invitation');
  }
}

// Verrouille la ligne du foyer jusqu'à la fin de la transaction : les opérations sur ses membres
// (invitation, acceptation, départ, transfert) s'exécutent l'une après l'autre.
// Requête paramétrée ($queryRaw et non $queryRawUnsafe) : aucune injection SQL possible.
async function lockHousehold(tx: Prisma.TransactionClient, householdId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "Household" WHERE "id" = ${householdId}::uuid FOR UPDATE`;
}

function activeInvitations(householdId: string, now: Date) {
  return { householdId, usedAt: null, expiresAt: { gt: now } } satisfies Prisma.HouseholdInvitationWhereInput;
}

function isUsable(invitation: { usedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  return invitation.usedAt === null && invitation.expiresAt > now;
}

function toInvitationResponse(invitation: { id: string; createdAt: Date; expiresAt: Date }): InvitationResponse {
  return {
    id: invitation.id,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
  };
}
