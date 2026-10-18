import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';

@Controller('health')
export class HealthController {
  // Public : utilisé par Docker et la supervision pour savoir si l'API répond.
  // Volontairement minimal : ni version, ni uptime, ni état des dépendances,
  // ce qui renseignerait un attaquant sur les failles connues à tenter.
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}