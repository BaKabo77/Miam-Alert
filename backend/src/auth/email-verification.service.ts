import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from '../common/security-logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { Mailer } from '../mail/mailer.js';
import { verificationEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { consumeEmailToken, issueEmailToken } from './email-tokens.js';

// Un lien de vérification reste valable 24 heures.
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
// Un nouvel email ne part pas moins d'une minute après le précédent : le bouton « renvoyer »
// ne peut pas servir à inonder une boîte mail.
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly security = new SecurityLogger();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // Renvoie false si un email est déjà parti il y a moins d'une minute (rien n'est envoyé).
  async sendVerification(userId: string, email: string): Promise<boolean> {
    const token = await issueEmailToken(
      this.prisma,
      userId,
      'EMAIL_VERIFICATION',
      EMAIL_VERIFICATION_TTL_MS,
      EMAIL_RESEND_COOLDOWN_MS,
    );
    if (!token) {
      return false;
    }
    // Jeton dans le fragment (#) et non dans la requête (?) : le navigateur n'envoie jamais le
    // fragment au serveur, il n'apparaît donc dans aucun journal d'accès (Nginx, Caddy).
    const link = `${this.config.get('APP_URL', { infer: true })}/verify-email#token=${token}`;
    await this.mailer.send(verificationEmail(email, link));
    return true;
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
      select: { email: true, emailVerifiedAt: true },
    });
    // Déjà vérifiée : rien à faire, et même réponse. La limite d'un email par minute est
    // appliquée par issueEmailToken.
    if (!user || user.emailVerifiedAt) {
      return;
    }

    try {
      await this.sendVerification(userId, user.email);
    } catch {
      throw new ServiceUnavailableException('Email could not be sent');
    }
  }

  async verify(token: string, ip: string | undefined): Promise<void> {
    const userId = await this.prisma.$transaction(async (tx) => {
      const owner = await consumeEmailToken(tx, token, 'EMAIL_VERIFICATION');
      if (owner) {
        await tx.user.update({ where: { id: owner }, data: { emailVerifiedAt: new Date() } });
      }
      return owner;
    });

    // Message unique pour tous les cas (inconnu, déjà utilisé, expiré, autre usage) : on ne
    // renseigne pas un attaquant sur l'état d'un jeton.
    if (!userId) {
      this.security.warn('auth.email_verification.invalid', { ip });
      throw new BadRequestException('Invalid or expired link');
    }
    this.security.log('auth.email_verified', { userId });
  }
}
