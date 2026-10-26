import { Injectable, Logger } from '@nestjs/common';
import type { ExpiryType } from '../generated/prisma/client.js';
import { todayUtc } from '../pantry/dates.js';
import { URGENT_WITHIN_DAYS } from '../pantry/urgency.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { needsAlert, summarizeForAlert } from './alert-summary.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
