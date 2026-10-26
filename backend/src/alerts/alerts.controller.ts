import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AlertsService } from './alerts.service.js';
import type { TodayAlertResponse } from './alerts.types.js';

// Routes protégées (aucune n'est @Public()) : access token obligatoire, et appartenance
// au foyer vérifiée par le service (404 pour le foyer ou l'alerte d'un autre).
@Controller()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('households/:householdId/alerts/today')
  findToday(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ): Promise<TodayAlertResponse> {
    return this.alerts.findToday(user.id, householdId);
  }

  @Post('alerts/:alertId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertId', ParseUUIDPipe) alertId: string,
  ): Promise<void> {
    return this.alerts.markAsRead(user.id, alertId);
  }
}
