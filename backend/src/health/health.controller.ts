import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Public : utilisé par Docker et la supervision pour savoir si l'API répond.
  // Volontairement minimal : ni version, ni uptime, ni détail sur la base,
  // ce qui renseignerait un attaquant sur les failles connues à tenter.
  @Public()
  @Get()
  async check() {
    try {
      // $queryRaw avec des backticks (template literal) : Prisma paramètre les valeurs,
      // contrairement à $queryRawUnsafe, interdit dans ce projet.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // 503 sans détail : la cause exacte n'a pas à sortir de l'API.
      throw new ServiceUnavailableException();
    }
    return { status: 'ok' };
  }
}
