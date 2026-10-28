import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { SecurityLogger } from '../common/security-logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { Mailer } from '../mail/mailer.js';
import { verificationEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Un lien de vérification reste valable 24 heures.
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
// Un nouvel email ne part pas moins d'une minute après le précédent : le bouton « renvoyer »
// ne peut pas servir à inonder une boîte mail.
const RESEND_COOLDOWN_MS = 60 * 1000;

// Même format que les refresh tokens : 32 octets aléatoires en base64url.
export const EMAIL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly security = new SecurityLogger();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // Crée un lien à usage unique et l'envoie. Les liens encore valables du même compte sont
  // annulés : seul le dernier email reçu fonctionne.
  async sendVerification(userId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.emailToken.updateMany({
        where: { userId, purpose: 'EMAIL_VERIFICATION', usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.emailToken.create({
        data: {
          userId,
          purpose: 'EMAIL_VERIFICATION',
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
        },
      }),
    ]);

    // Jeton dans le fragment (#) et non dans la requête (?) : le navigateur n'envoie jamais le
    // fragment au serveur, il n'apparaît donc dans aucun journal d'accès (Nginx, Caddy).
    const link = `${this.config.get('APP_URL', { infer: true })}/verify-email#token=${token}`;
    await this.mailer.send(verificationEmail(email, link));
  }

  // Après l'inscription : l'envoi ne bloque pas la réponse et un échec ne fait pas échouer
  // l'inscription (l'utilisateur pourra demander un nouvel email).
  sendVerificationInBackground(userId: string, email: string): void {
    this.sendVerification(userId, email).catch((error: unknown) => {
      // Ni l'adresse ni le lien dans les logs : seulement la nature de l'erreur.
      this.logger.warn(`Verification email not sent: ${error instanceof Error ? error.name : 'unknown error'}`);
    });
  }

  async resend(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerifiedAt: true,
        emailTokens: {
          where: { purpose: 'EMAIL_VERIFICATION' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    // Déjà vérifiée, ou email envoyé il y a moins d'une minute : rien à faire, et même réponse.
    const lastSentAt = user?.emailTokens[0]?.createdAt;
    if (!user || user.emailVerifiedAt || (lastSentAt && Date.now() - lastSentAt.getTime() < RESEND_COOLDOWN_MS)) {
      return;
    }

    try {
      await this.sendVerification(userId, user.email);
    } catch {
      throw new ServiceUnavailableException('Email could not be sent');
    }
  }

  async verify(token: string, ip: string | undefined): Promise<void> {
    const stored = await this.prisma.emailToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, purpose: true, expiresAt: true, usedAt: true },
    });

    // Message unique pour tous les cas (inconnu, déjà utilisé, expiré, autre usage) : on ne
    // renseigne pas un attaquant sur l'état d'un jeton.
    const invalid = () => {
      this.security.warn('auth.email_verification.invalid', { ip });
      return new BadRequestException('Invalid or expired link');
    };
    if (!stored || stored.purpose !== 'EMAIL_VERIFICATION' || stored.usedAt || stored.expiresAt <= new Date()) {
      throw invalid();
    }

    const verified = await this.prisma.$transaction(async (tx) => {
      // Condition "usedAt: null" : si le lien est ouvert deux fois en même temps, un seul passe.
      const { count } = await tx.emailToken.updateMany({
        where: { id: stored.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) {
        return false;
      }
      await tx.user.update({ where: { id: stored.userId }, data: { emailVerifiedAt: new Date() } });
      return true;
    });
    if (!verified) {
      throw invalid();
    }

    this.security.log('auth.email_verified', { userId: stored.userId });
  }
}
