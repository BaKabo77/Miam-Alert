import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { applyTrustProxy } from './common/trust-proxy.js';
import { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  // On désactive les parseurs par défaut pour déclarer nous-mêmes ceux qu'on accepte (voir plus bas).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // En production, l'API est derrière le reverse proxy (Caddy) : voir trust-proxy.ts.
  applyTrustProxy(app, config.get('TRUST_PROXY', { infer: true }));

  // En-têtes de sécurité : interdit l'affichage dans une iframe (clickjacking), empêche
  // le navigateur de deviner le type des fichiers, masque "X-Powered-By: Express", etc.
  app.use(helmet());

  // L'API ne reçoit que du JSON, limité à 16 ko : un inventaire n'a pas besoin de plus,
  // et un corps énorme servirait seulement à saturer la mémoire du serveur (déni de service).
  // Aucun autre format (formulaire, texte brut) n'est accepté.
  app.useBodyParser('json', { limit: '16kb' });

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
