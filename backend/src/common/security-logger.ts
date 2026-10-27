import { Logger } from '@nestjs/common';

export type SecurityEvent =
  | 'auth.register'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.refresh'
  | 'auth.refresh.reuse_detected'
  | 'auth.logout'
  | 'rate_limit.exceeded'
  | 'household.access_denied'
  | 'account.deleted'
  | 'account.exported'
  | 'account.delete.denied';

// Seuls champs autorisés dans un événement de sécurité. Le type rend impossible d'y glisser
// un email, un mot de passe, un token ou un cookie : le code ne compilerait pas.
export interface SecurityEventDetails {
  userId?: string;
  ip?: string;
  path?: string;
}

// Une ligne JSON par événement : facile à filtrer et à exploiter par un outil de supervision
// (« combien d'échecs de connexion depuis cette IP dans la dernière heure ? »).
export class SecurityLogger {
  private readonly logger = new Logger('Security');

  log(event: SecurityEvent, details: SecurityEventDetails = {}): void {
    this.logger.log(JSON.stringify({ event, ...details }));
  }

  warn(event: SecurityEvent, details: SecurityEventDetails = {}): void {
    this.logger.warn(JSON.stringify({ event, ...details }));
  }
}
