import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload, AuthTokens, UserResponse } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_TOKEN_PATTERN
} from './refresh-token.js';

const DEFAULT_HOUSEHOLD_NAME = 'Mon foyer';

@Injectable()
export class AuthService {

  private readonly logger = new Logger(AuthService.name);
  // Hash factice, calculé une seule fois, utilisé quand l'email n'existe pas (voir login).
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) { }

  async register(dto: RegisterDto): Promise<UserResponse> {
    // Hachage AVANT de savoir si l'email existe : la réponse prend le même temps dans
    // les deux cas, on ne peut pas deviner les comptes existants en chronométrant.
    const passwordHash = await hashPassword(dto.password);

    try {
      // Compte, foyer et appartenance (OWNER) créés en une seule requête :
      // tout réussit ou rien n'est créé.
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          memberships: {
            create: { role: 'OWNER', household: { create: { name: DEFAULT_HOUSEHOLD_NAME } } },
          },
        },
        // Réponse construite explicitement : seuls l'id et l'email sortent de l'API.
        select: { id: true, email: true },
      });
    } catch (error) {
      // P2002 = violation de la contrainte d'unicité sur l'email. On s'appuie sur la base
      // plutôt que sur un "SELECT puis INSERT", qui laisserait passer deux inscriptions simultanées.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    // Seul endroit de l'application où le hash du mot de passe est lu.
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true },
    });

    // Si l'email n'existe pas, on vérifie quand même un hash factice : la réponse prend
    // le même temps (~argon2) dans les deux cas, on ne peut pas deviner les comptes existants.
    const passwordHash = user?.passwordHash ?? (await this.getDummyPasswordHash());
    const passwordIsValid = await verifyPassword(passwordHash, dto.password);

    if (!user || !passwordIsValid) {
      // Message identique pour un email inconnu et un mauvais mot de passe.
      throw new UnauthorizedException('Invalid credentials');
    }

    // Nouvelle connexion = nouvelle famille de refresh tokens (une "session").
    return this.issueTokens(user.id, randomUUID());
  }

  async refresh(refreshToken: string | undefined): Promise<AuthTokens> {
    const stored = await this.findRefreshToken(refreshToken);
    if (!stored) {
      throw new UnauthorizedException();
    }

    // Token déjà utilisé (ou révoqué) qui revient : quelqu'un en a gardé une copie.
    // On ne peut pas savoir qui est le vrai utilisateur, donc on coupe toute la session :
    // l'attaquant comme l'utilisateur devront se reconnecter avec le mot de passe.
    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      this.logger.warn(`Refresh token reuse detected, session revoked for user ${stored.userId}`);
      throw new UnauthorizedException();
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException();
    }

    // Rotation : l'ancien token est révoqué avant d'en émettre un nouveau.
    // La condition "revokedAt: null" rend l'opération atomique : si deux requêtes
    // présentent le même token en même temps, une seule peut gagner.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException();
    }

    // Même famille : le nouveau token appartient toujours à la même session.
    return this.issueTokens(stored.userId, stored.familyId);
  }

  // Révoque toute la session côté serveur. Sans token valide, il n'y a rien à révoquer :
  // la déconnexion réussit quand même (le cookie sera effacé), sans rien révéler.
  async logout(refreshToken: string | undefined): Promise<void> {
    const stored = await this.findRefreshToken(refreshToken);
    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  private findRefreshToken(refreshToken: string | undefined) {
    if (!refreshToken || !REFRESH_TOKEN_PATTERN.test(refreshToken)) {
      return Promise.resolve(null);
    }
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, familyId: string): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const payload: AccessTokenPayload = { sub: userId };
    const accessToken = await this.jwt.signAsync(payload);

    return { accessToken, refreshToken };
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= hashPassword(generateRefreshToken());
    return this.dummyPasswordHash;
  }
}
