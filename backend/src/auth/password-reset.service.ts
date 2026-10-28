import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityLogger } from '../common/security-logger.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { Mailer } from '../mail/mailer.js';
import { passwordResetEmail } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { consumeEmailToken, issueEmailToken } from './email-tokens.js';
import { EMAIL_RESEND_COOLDOWN_MS } from './email-verification.service.js';
import { hashPassword } from './password.js';

// Lien de réinitialisation valable 30 minutes : il donne accès au compte, il doit vivre peu.
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly security = new SecurityLogger();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // Toujours la même réponse, immédiate, que l'adresse ait un compte ou non : la route ne doit pas
  // permettre de savoir qui est inscrit. Le travail réel (jeton, email) se fait en arrière-plan,
  // pour que le temps de réponse ne trahisse rien non plus.
  requestReset(email: string, ip: string | undefined): void {
    this.security.log('auth.password_reset.requested', { ip });
    this.sendResetLink(email).catch((error: unknown) => {
      this.logger.warn(`Password reset email not sent: ${error instanceof Error ? error.name : 'unknown error'}`);
    });
  }

  private async sendResetLink(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return;
    }
    // Un email par minute au plus (verrou en base, voir issueEmailToken) : la route ne peut pas
    // servir à inonder la boîte de quelqu'un.
    const token = await issueEmailToken(
      this.prisma,
      user.id,
      'PASSWORD_RESET',
      PASSWORD_RESET_TTL_MS,
      EMAIL_RESEND_COOLDOWN_MS,
    );
    if (!token) {
      return;
    }
    // Jeton dans le fragment (#) : jamais envoyé au serveur, absent des journaux d'accès.
    const link = `${this.config.get('APP_URL', { infer: true })}/reset-password#token=${token}`;
    await this.mailer.send(passwordResetEmail(email, link));
  }

  async resetPassword(token: string, newPassword: string, ip: string | undefined): Promise<void> {
    // Hachage avant la transaction : argon2 est lent, la transaction reste courte.
    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    const userId = await this.prisma.$transaction(async (tx) => {
      const owner = await consumeEmailToken(tx, token, 'PASSWORD_RESET');
      if (!owner) {
        return null;
      }
      await tx.user.update({
        where: { id: owner },
        // Ouvrir le lien prouve l'accès à la boîte mail : l'adresse est vérifiée du même coup.
        data: { passwordHash, emailVerifiedAt: now },
      });
      // Toutes les sessions sont fermées : si le compte était compromis, l'intrus est déconnecté.
      await tx.refreshToken.updateMany({ where: { userId: owner, revokedAt: null }, data: { revokedAt: now } });
      return owner;
    });

    if (!userId) {
      this.security.warn('auth.password_reset.invalid', { ip });
      throw new BadRequestException('Invalid or expired link');
    }
    this.security.log('auth.password_reset.completed', { userId });
  }
}
