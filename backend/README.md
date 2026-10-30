# API (backend)

API REST de Miam'Alert : NestJS 12, TypeScript (modules ES), Prisma 7 et PostgreSQL 16. Elle porte **toute** la logique métier et **toutes** les règles de sécurité : le front n'est qu'une interface, l'API ne lui fait jamais confiance.

Vue d'ensemble du projet : [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Organisation

Un module NestJS par domaine, chacun avec son README :

| Dossier | Contenu |
|---|---|
| [`src/auth/`](src/auth/README.md) | Inscription, connexion, sessions, emails de vérification et de réinitialisation, guard JWT |
| [`src/users/`](src/users/README.md) | `/me` : profil, export des données, suppression du compte |
| [`src/households/`](src/households/README.md) | Contrôle d'appartenance à un foyer (anti-IDOR) |
| [`src/pantry/`](src/pantry/README.md) | Inventaire, urgence, dates |
| [`src/products/`](src/products/README.md) | Code-barres, Open Food Facts, date suggérée |
| [`src/alerts/`](src/alerts/README.md) | Alerte quotidienne de 9 h |
| [`src/mail/`](src/mail/README.md) | Envoi d'emails (SMTP) |
| [`src/maintenance/`](src/maintenance/README.md) | Purge nocturne |
| [`src/common/`](src/common/README.md) | Briques transverses : erreurs, validation, limites de débit, journal de sécurité, pagination… |
| `src/config/` | Validation des variables d'environnement (voir plus bas) |
| `src/prisma/` | `PrismaService`, seul accès à la base (voir [prisma/README.md](prisma/README.md)) |
| `src/health/` | `GET /health`, utilisé par Docker et la supervision |
| `src/generated/prisma/` | Client Prisma **généré** (non commité, recréé par `npx prisma generate`) |
| `prisma/` | Schéma et migrations |
| `test/` | Tests e2e (voir « Tests ») |

Dans un module, on retrouve toujours la même forme : `*.controller.ts` (routes HTTP, aucune logique), `*.service.ts` (logique et accès base), `dto/` (ce que la route accepte), `*.types.ts` (ce que la route renvoie), et des fonctions pures testables à part (`urgency.ts`, `ean.ts`…).

## Démarrage de l'application

[`src/main.ts`](src/main.ts) crée l'application et branche, dans l'ordre :

1. un logger JSON en production (une ligne par message, exploitable par un outil de supervision), lisible en dev ;
2. `trust proxy` selon `TRUST_PROXY` (voir [common/trust-proxy.ts](src/common/trust-proxy.ts)) ;
3. `helmet` (en-têtes de sécurité) ;
4. un seul parseur de corps : **JSON, 16 ko au maximum** ;
5. CORS limité aux origines de `CORS_ORIGINS`, avec cookies.

[`src/app.module.ts`](src/app.module.ts) enregistre ensuite les éléments **globaux**, qui s'appliquent à toutes les routes :

| Élément | Effet |
|---|---|
| `ConfigModule` + `validateEnv` | L'application **refuse de démarrer** si une variable manque ou est invalide |
| `LoggingThrottlerGuard` | Limite de débit par IP (100/min par défaut), dépassements journalisés |
| `JwtAuthGuard` | **Refus par défaut** : toute route exige un access token, sauf `@Public()` |
| `ValidationPipe` | Validation des DTO, champs inconnus rejetés (400) |
| `AllExceptionsFilter` | Aucune trace technique renvoyée au client (500 générique) |
| `ScheduleModule` | Active les tâches planifiées (`@Cron`) : alertes à 9 h, purge à 4 h |

## Configuration

Toutes les variables sont validées au démarrage par [`src/config/env.validation.ts`](src/config/env.validation.ts). Une erreur affiche le **nom** de la variable fautive, jamais sa valeur.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `NODE_ENV` | oui | `development`, `test` ou `production` (logs JSON et TLS SMTP obligatoire en production) |
| `PORT` | oui | Port d'écoute (3000) |
| `DATABASE_URL` | oui | URL PostgreSQL (hôte `db` en Docker) |
| `JWT_SECRET` | oui | Secret de signature des access tokens, **32 caractères minimum** |
| `CORS_ORIGINS` | oui | Origines autorisées, séparées par des virgules ; `*` est refusé |
| `TRUST_PROXY` | non (0) | Nombre de proxys devant l'API : 0 en dev, 1 en production |
| `APP_URL` | oui | Adresse du front, pour construire les liens des emails |
| `SMTP_HOST`, `SMTP_PORT` | oui | Serveur d'emails (Mailpit en dev, Brevo en production) |
| `SMTP_USER`, `SMTP_PASSWORD` | non | Identifiants SMTP (inutiles avec Mailpit) |
| `MAIL_FROM` | oui | Adresse d'expédition |
| `ALERTS_HEALTHCHECK_URL` | non | Adresse prévenue après la tâche de 9 h (HTTPS uniquement) |
| `DATABASE_URL_TEST` | tests e2e | Base des tests, dont le nom **doit** finir par `_test` |

Ajouter une variable : la déclarer dans `EnvironmentVariables`, avec ses règles, dans `.env.example` (valeur factice), dans `.env.prod.example` si elle sert en production, et dans le bloc `environment` du service `api` de `docker-compose.prod.yml`. Chaque conteneur ne reçoit que ses propres variables.

## Commandes

Les plus courantes ci-dessous ; la liste complète est dans [docs/COMMANDES.md](../docs/COMMANDES.md). Tout se lance **dans le conteneur**, pour que l'hôte `db` soit résolu :

```bash
docker compose logs -f backend                                  # journaux
docker compose exec backend npm run lint                        # oxlint (avec les types)
docker compose exec backend npm test                            # tests unitaires
docker compose exec backend npm run test:e2e                    # tests e2e
docker compose exec backend npx prisma migrate dev --name <nom> # nouvelle migration
docker compose exec backend npx prisma generate                 # régénérer le client
docker compose exec backend npm run build && docker compose exec backend npm run alerts:generate
docker compose restart backend                                  # redémarrer (dist/ périmé, variable modifiée)
docker compose exec backend npm audit --audit-level=high        # vulnérabilités des dépendances
```

Lancer seulement les tests d'une partie : le filtre est un morceau du chemin des fichiers.

```bash
docker compose exec backend npm test -- src/pantry                   # unitaires d'un module
docker compose exec backend npm run test:e2e -- pantry               # e2e dont le nom contient « pantry »
docker compose exec backend npm run test:e2e -- auth- password-reset # plusieurs filtres
```

Chaque module a sa propre section « Commandes », avec les appels de ses routes : voir les README de `src/*/`.

## Tests

| Type | Fichiers | Lancement | Ce qu'ils couvrent |
|---|---|---|---|
| Unitaires | `src/**/*.spec.ts` | `npm test` | Fonctions pures et classes isolées : urgence, EAN, nettoyage Open Food Facts, date suggérée, résumé d'alerte, validation de l'environnement, signal de vie |
| End-to-end | `test/*.e2e-spec.ts` | `npm run test:e2e` | L'application complète sur une vraie base PostgreSQL : chaque route, **chaque tentative d'accès à un autre foyer**, tokens expirés ou falsifiés, rejeu d'un refresh token, validation, limites de débit, absence de données sensibles dans les logs |

Fonctionnement des tests e2e ([`test/setup/`](test/setup)) :
- `global-setup.ts` applique les migrations sur la base de test une fois, avant tous les tests ;
- `reset-database.ts` vide toutes les tables avant chaque test ;
- `test-database.ts` est un **garde-fou** : les tests refusent de tourner sur une base dont le nom ne finit pas par `_test` ;
- `test-users.ts` crée un compte connecté et renvoie son token et son foyer ;
- les fichiers s'exécutent l'un après l'autre (`fileParallelism: false`), car ils partagent la même base ;
- les emails sont capturés par un faux `Mailer` (voir [mail/](src/mail/README.md)) : aucun test ne dépend d'un service extérieur.

En CI, les tests e2e tournent avec un PostgreSQL et un Mailpit éphémères (voir [docs/CI-CD.md](../docs/CI-CD.md)).

## Ajouter une route

1. **Qui y a droit ?** Par défaut, il faut être connecté. Une route publique reçoit `@Public()` **avec un commentaire qui justifie pourquoi**.
2. **Identité** : toujours `@CurrentUser()`, jamais un `userId` lu dans le corps ou l'URL.
3. **Données d'un foyer** : appartenance vérifiée, soit avec `HouseholdAccessService.assertMember()`, soit par un filtre dans la requête Prisma (voir [households/](src/households/README.md)). L'accès refusé donne 404, pas 403.
4. **Entrée** : un DTO avec des règles strictes (types, longueurs, formats). Identifiants dans l'URL validés par `ParseUUIDPipe`.
5. **Sortie** : un `select` Prisma explicite et un type de réponse dédié. Jamais d'entité brute, jamais de champ interne.
6. **Liste** : pagination obligatoire (`PaginationQuery`, 100 au maximum).
7. **Limite de débit** : `@Throttle(...)` plus strict si la route est sensible (mot de passe, envoi d'email, appel externe, export).
8. **Journal** : un événement de sécurité si l'action le mérite (`SecurityLogger`), sans donnée personnelle.
9. **Tests** : tests unitaires de la logique, tests e2e de la route, avec le cas « autre foyer » refusé.
10. **Documentation** : mettre à jour le README du module, ainsi que le tableau des routes du [README racine](../README.md#api).

## Pièges connus

- **Imports en `.js`** : le projet est en modules ES. On écrit `import … from './auth.service.js'` même si le fichier est un `.ts`.
- **Client Prisma absent** après un clone ou un changement de schéma : `npx prisma generate`. Le conteneur de dev le fait à chaque démarrage.
- **`dist/` périmé** : après un test qui modifie un fichier puis le restaure, le compilateur en mode watch peut garder l'ancienne version. Il faut redémarrer le conteneur `backend`.
- **Prisma 7** : la configuration est dans `prisma.config.ts`, pas dans `package.json`. Les versions de Prisma sont épinglées en exact.
- **npm 11** bloque les scripts d'installation : seuls ceux listés dans `allowScripts` (`package.json`) s'exécutent.
- **Images de production** ([`Dockerfile`](Dockerfile)) : cible `runtime` (l'API, sans npm ni dépendances de développement) et cible `migrate` (dépendances de production et CLI Prisma, sans npm). L'image de dev est `Dockerfile.dev`.
