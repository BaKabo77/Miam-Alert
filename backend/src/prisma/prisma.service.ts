import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaClient } from '../generated/prisma/client.js';

// Champs exclus de TOUTES les requêtes par défaut : le hash du mot de passe ne peut pas
// sortir de la base par erreur. Le service d'authentification devra le redemander
// explicitement (omit: { passwordHash: false }), seul endroit où il est utile.
const globalOmit = { user: { passwordHash: true } } as const;

@Injectable()
export class PrismaService
  extends PrismaClient<{ adapter: PrismaPg; omit: typeof globalOmit }>
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    // URL lue depuis la configuration validée au démarrage, jamais en dur.
    const adapter = new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) });
    // Pas d'option "log: ['query']" : les requêtes journalisées contiendraient
    // des données personnelles (emails, inventaires).
    super({ adapter, omit: globalOmit });
  }

  // Connexion au démarrage : si la base est injoignable, l'API le signale tout de suite
  // au lieu d'échouer à la première requête d'un utilisateur.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Fermeture propre des connexions à l'arrêt de l'application.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
