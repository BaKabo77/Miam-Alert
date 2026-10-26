import { NestExpressApplication } from '@nestjs/platform-express';

// Derrière un reverse proxy, toutes les connexions arrivent depuis l'IP du proxy : le rate limiting
// compterait tous les utilisateurs ensemble et les logs n'auraient jamais l'IP de l'attaquant.
// L'IP réelle est transmise par le proxy dans X-Forwarded-For, mais ce n'est qu'un en-tête :
// n'importe quel client peut en envoyer un faux. On ne fait donc confiance qu'au nombre EXACT de
// proxys placés devant l'API (le dernier ajouté par chacun), jamais à "true", qui accepterait
// l'IP inventée par le client et rendrait le rate limiting contournable.
export function applyTrustProxy(app: NestExpressApplication, trustedProxyHops: number): void {
  if (trustedProxyHops > 0) {
    app.set('trust proxy', trustedProxyHops);
  }
}
