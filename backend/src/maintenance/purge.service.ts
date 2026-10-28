import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Délais de conservation APRÈS qu'une donnée est devenue inutile (annoncés dans la politique de
// confidentialité). Pas de suppression immédiate : ces traces permettent d'enquêter sur un
// incident (quand une session a été ouverte, quand un lien a servi), et un ancien jeton de session
// doit rester reconnaissable pour que sa réutilisation soit détectée comme un vol.
export const RETENTION = {
  // Sessions : 30 jours après leur expiration.
  expiredSessionsDays: 30,
  // Liens envoyés par email : 30 jours après avoir servi ou expiré.
  emailTokensDays: 30,
  // Alertes du jour : 90 jours après le jour concerné.
  alertsDays: 90,
};

export interface PurgeResult {
  sessions: number;
  emailTokens: number;
  alerts: number;
}

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purgeExpiredData(now = new Date()): Promise<PurgeResult> {
    const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const emailTokensLimit = before(RETENTION.emailTokensDays);

    const [sessions, emailTokens, alerts] = await this.prisma.$transaction([
      // Une session expirée ne peut plus servir (le refresh est refusé après expiresAt).
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: before(RETENTION.expiredSessionsDays) } } }),
      this.prisma.emailToken.deleteMany({
        where: { OR: [{ usedAt: { lt: emailTokensLimit } }, { expiresAt: { lt: emailTokensLimit } }] },
      }),
      this.prisma.alert.deleteMany({ where: { date: { lt: before(RETENTION.alertsDays) } } }),
    ]);

    const result = { sessions: sessions.count, emailTokens: emailTokens.count, alerts: alerts.count };
    // Des nombres seulement : aucune donnée personnelle dans les logs.
    this.logger.log(`Purge: ${result.sessions} session(s), ${result.emailTokens} email link(s), ${result.alerts} alert(s)`);
    return result;
  }
}
