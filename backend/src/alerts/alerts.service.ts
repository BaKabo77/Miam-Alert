import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ExpiryType, Prisma } from '../generated/prisma/client.js';
import { HouseholdAccessService } from '../households/household-access.service.js';
import { formatDateOnly, todayUtc } from '../pantry/dates.js';
import { URGENT_WITHIN_DAYS } from '../pantry/urgency.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { needsAlert, summarizeForAlert } from './alert-summary.js';
import type { AlertResponse, TodayAlertResponse } from './alerts.types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ALERT_SELECT = {
  id: true,
  date: true,
  expiredCount: true,
  urgentCount: true,
  readAt: true,
} satisfies Prisma.AlertSelect;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly householdAccess: HouseholdAccessService,
  ) {}

  // L'alerte du jour d'un foyer, réservée à ses membres (404 sinon, comme l'inventaire).
  async findToday(userId: string, householdId: string): Promise<TodayAlertResponse> {
    await this.householdAccess.assertMember(userId, householdId);

    const alert = await this.prisma.alert.findUnique({
      // Recherche par la clé unique (foyer, jour) : directe grâce à l'index de la contrainte @@unique([householdId, date]).
      where: { householdId_date: { householdId, date: todayUtc() } },
      select: ALERT_SELECT,
    });
    return { alert: alert ? toAlertResponse(alert) : null };
  }

  // Marque une alerte comme lue (bandeau fermé). L'alerte d'un autre foyer est introuvable (404).
  // Idempotent : une alerte déjà lue garde sa première date de lecture.
  async markAsRead(userId: string, alertId: string): Promise<void> {
    const alert = await this.prisma.alert.findFirst({
      // Contrôle d'accès dans la requête, comme pour les articles de l'inventaire.
      where: { id: alertId, household: { members: { some: { userId } } } },
      select: { id: true, readAt: true },
    });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    if (!alert.readAt) {
      await this.prisma.alert.update({ where: { id: alert.id }, data: { readAt: new Date() } });
    }
  }

  // Crée l'alerte du jour de chaque foyer qui a des produits périmés ou à consommer vite.
  // Idempotent : relancée le même jour, elle ne crée aucun doublon (contrainte unique en base).
  // Renvoie le nombre d'alertes réellement créées.
  async generateDailyAlerts(today: Date = todayUtc()): Promise<number> {
    // Seuls les articles actifs qui périment au plus tard dans URGENT_WITHIN_DAYS jours peuvent
    // déclencher une alerte : inutile de charger tout l'inventaire de tous les foyers.
    const limit = new Date(today.getTime() + URGENT_WITHIN_DAYS * MS_PER_DAY);
    const items = await this.prisma.pantryItem.findMany({
      where: { status: 'ACTIVE', expiryDate: { lte: limit } },
      select: { householdId: true, expiryDate: true, expiryType: true },
    });

    // Regroupement par foyer : une seule alerte par foyer, pas une par produit.
    const byHousehold = new Map<string, { expiryDate: Date; expiryType: ExpiryType }[]>();
    for (const { householdId, ...item } of items) {
      byHousehold.set(householdId, [...(byHousehold.get(householdId) ?? []), item]);
    }

    const alerts = [...byHousehold]
      .map(([householdId, householdItems]) => ({
        householdId,
        date: today,
        ...summarizeForAlert(householdItems, today),
      }))
      .filter(needsAlert);

    // skipDuplicates (ON CONFLICT DO NOTHING en SQL) : un foyer qui a déjà son alerte du jour
    // est simplement ignoré. La base garantit l'unicité, même si deux exécutions se croisent.
    const { count } = await this.prisma.alert.createMany({ data: alerts, skipDuplicates: true });

    // Uniquement des nombres dans les logs : aucun identifiant de foyer ni nom de produit.
    this.logger.log(`Daily alerts: ${count} created for ${alerts.length} household(s) needing one`);
    return count;
  }
}

function toAlertResponse(alert: Prisma.AlertGetPayload<{ select: typeof ALERT_SELECT }>): AlertResponse {
  return {
    id: alert.id,
    date: formatDateOnly(alert.date),
    expiredCount: alert.expiredCount,
    urgentCount: alert.urgentCount,
    read: alert.readAt !== null,
  };
}
