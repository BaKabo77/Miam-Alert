# Miam'Alert — garde-manger anti-gaspi

Application full-stack de suivi des produits alimentaires du foyer : l'utilisateur scanne ses courses, l'appli suit les dates de péremption, alerte avant qu'un produit périme et suggère des recettes avec les produits les plus urgents.

Projet portfolio personnel (développeur full-stack orienté backend, recherche d'alternance). Le code doit être propre, lisible et bien structuré : il sera montré à des recruteurs.

**La sécurité est l'axe principal du projet (security by design).** Elle n'est pas ajoutée à la fin : chaque fonctionnalité est conçue, codée et testée avec la sécurité en tête, en s'appuyant sur l'OWASP Top 10 et l'OWASP API Security Top 10. Le développeur a travaillé dans un environnement normé (HDS, ISO 27001) et veut que ce projet le démontre.

Règles pour Claude Code :
- Entre rapidité et sécurité, choisir la sécurité et expliquer brièvement pourquoi.
- Signaler toute faille repérée, même hors de la tâche en cours, sans la corriger en silence.
- Pour chaque nouvelle route : préciser qui a le droit d'y accéder et comment c'est vérifié.
- Expliquer les choix de sécurité au fil du code (commentaires courts sur le « pourquoi »), pour que le développeur puisse les justifier en entretien.
- Appliquer la checklist « Définition de terminé » (section Sécurité) avant de déclarer une fonctionnalité finie.

## Langue

- Échanges et explications : en français.
- Code (variables, fonctions, classes, routes) : en anglais.

## Stack

| Couche | Choix |
|---|---|
| Backend | NestJS (TypeScript) |
| ORM | Prisma |
| Base de données | PostgreSQL 16 |
| Front (plus tard) | React ou Vue en PWA (scan caméra, notifications push, hors ligne) |
| Scan code-barres | `@zxing/browser` ou `html5-qrcode` (EAN-13) |
| Données produit | API Open Food Facts (gratuite) |
| Tâches planifiées | `@nestjs/schedule`, puis BullMQ + Redis si besoin |
| Environnement | Docker Compose (db, adminer, backend) |
| CI/CD (plus tard) | GitHub Actions, déploiement Docker + Nginx |

## Contraintes et décisions déjà prises

- **Pas de LLM local** (pas d'Ollama) : impossible à héberger pour ce projet.
- **Recettes, V1 sans IA** : base de recettes en BDD, ingrédients liés à des catégories, score par recette = ingrédients possédés pondérés par l'urgence de péremption.
- **Recettes, V2** : bonus IA via une API hébergée (Mistral ou Gemini), en complément.
- Prévoir une interface `RecipeProvider` avec deux implémentations (`LocalRecipeProvider`, `AiRecipeProvider`) pour changer de source sans toucher au reste.
- **Un code-barres ne contient pas la date de péremption** : l'utilisateur la saisit. Rendre cette étape rapide (date suggérée selon la catégorie, raccourcis +3 j / +1 sem / +1 mois). OCR de la date en V2.
- **Distinguer DLC et DDM** (`expiryType`) : DLC = à respecter strictement, DDM = consommable après la date.
- **Cache des produits** : les infos Open Food Facts sont stockées dans la table `Product` (clé : `barcode` unique) au lieu d'appeler l'API à chaque fois.
- **`Household` dès le départ** : l'inventaire appartient à un foyer, pas à un utilisateur, même si la V1 n'a qu'un membre. Le partage en V2 sera ainsi simple.

## Modèle de données (cible, à construire progressivement)

```
User ──< HouseholdMember >── Household
                                 ├──< StorageLocation (frigo, congélateur, placard)
                                 └──< PantryItem
                                        ├── product → Product
                                        ├── quantity, unit
                                        ├── expiryDate, expiryType (DLC | DDM)
                                        ├── location → StorageLocation
                                        └── status (ACTIVE | CONSUMED | WASTED | FROZEN)

Product : barcode (unique), name, brand, imageUrl, category, nutriscore
ConsumptionEvent : pantryItem, action, date   → statistiques de gaspillage
```

Commencer petit : `User`, `Household`, `HouseholdMember`, `Product`, `PantryItem`. Le reste vient ensuite.

## Structure du dépôt

```
miam-alert/             # nom technique (npm, Docker) ; nom affiché : Miam'Alert
├── backend/            # NestJS
│   ├── Dockerfile.dev
│   ├── prisma/
│   └── src/
├── frontend/           # plus tard
├── docker-compose.yml
├── .env                # jamais commité
├── .env.example        # commité, valeurs factices
└── .gitignore
```

## Environnement

Tout tourne dans Docker. Le `.env` est à la racine ; dans `DATABASE_URL`, l'hôte est `db` (nom du service Docker), pas `localhost`.

```bash
docker compose up -d --build          # lancer
docker compose logs -f backend        # logs du backend
docker compose exec backend npx prisma migrate dev --name <nom>
docker compose exec backend npx prisma generate
docker compose exec backend npx prisma studio
docker compose exec backend npm run test
```

Les commandes Prisma se lancent **dans le conteneur** pour que l'hôte `db` soit résolu.

- Backend : http://localhost:3000
- Adminer : http://localhost:8080 (système PostgreSQL, serveur `db`)

Le volume `./backend:/app` assure le rechargement automatique ; le volume anonyme `/app/node_modules` évite d'écraser les dépendances du conteneur.

Points d'environnement à connaître :
- Ports publiés sur `127.0.0.1` uniquement ; PostgreSQL n'est pas publié du tout (accès via Adminer ou `docker compose exec db psql`).
- Le conteneur backend tourne en utilisateur `node` (non-root), même en dev.
- **npm 11 requis** sur l'hôte (npm 10 plante sur l'arbre de dépendances de Vitest) : `npx npm@11 install <pkg>` ou Node 24. L'image Docker est en `node:24-alpine`.
- npm 11 bloque les scripts d'installation par défaut ; seuls ceux listés dans `allowScripts` (`package.json`) s'exécutent. Pour en autoriser un : `npm install-scripts approve <pkg>`, après vérification.
- Prisma 7 : config dans `backend/prisma.config.ts`, client généré dans `backend/src/generated/prisma` (non commité, régénéré au démarrage du conteneur), connexion via `@prisma/adapter-pg`. Versions Prisma épinglées en exact (le tag npm `latest` pointait sur une RC).

## Conventions de code

- Un module NestJS par domaine (`auth`, `pantry`, `products`, `recipes`…), avec controller, service et DTO.
- Validation des entrées avec `class-validator` / `class-transformer` et un `ValidationPipe` global.
- Accès BDD uniquement via un `PrismaService` injectable.
- Configuration via `@nestjs/config`, jamais de secret en dur.
- Tests unitaires sur la logique métier (services), au minimum pour le tri par urgence et le score des recettes.
- Petits commits fréquents, un sujet par commit.

## Sécurité

### Secrets et dépôt
- Ne jamais commiter `.env` ni aucun secret. Vérifier `git status` avant chaque commit.
- Le dépôt est privé pour l'instant mais passera en public : tout l'historique doit rester propre. Si un secret fuit, le changer (rotation) plutôt que de réécrire l'historique.
- Toutes les variables d'environnement sont validées au démarrage (schéma de validation dans `ConfigModule`) : l'appli refuse de démarrer si une variable manque ou si `JWT_SECRET` est trop court.
- Secrets de dev et de prod distincts ; aucun secret en dur, ni dans le code, ni dans les Dockerfile, ni dans les logs.
- les commits doivent toujours commencer par [ADD,EDIT,DELETE,UPDATE] en fonction de ce qui est commit

### Authentification
- Mots de passe hachés avec **argon2** (argon2id). Politique de mot de passe raisonnable (longueur minimale de 12 caractères plutôt que des règles de complexité).
- **Access token JWT court** (≈ 15 min) + **refresh token** stocké en cookie `httpOnly`, `Secure`, `SameSite=Strict`, avec **rotation** à chaque usage et révocation possible (refresh tokens hachés en BDD).
- Déconnexion = révocation du refresh token côté serveur.
- Messages d'erreur génériques à la connexion (« identifiants invalides ») pour ne pas révéler si un email existe.
- Rate limiting renforcé sur `/auth/*` (inscription, connexion, refresh) contre le brute force.
- Plus tard : vérification de l'email, réinitialisation du mot de passe par token à usage unique et expirant.

### Autorisation (contrôle d'accès)
- **Refus par défaut** : un guard JWT global, les routes publiques sont marquées explicitement (`@Public()`).
- **Protection contre les IDOR** (accès aux données d'un autre foyer en changeant un id) : chaque accès à un `PantryItem`, `StorageLocation` ou `Household` vérifie que l'utilisateur est membre du foyer. Filtrer les requêtes Prisma par `householdId` plutôt que vérifier après coup.
- Rôles dans le foyer (`OWNER`, `MEMBER`) préparés pour la V2, vérifiés par un guard dédié.
- Identifiants exposés en **UUID** (pas d'id auto-incrémenté devinable).
- Ne jamais faire confiance à un `householdId` ou `userId` envoyé par le client sans vérification ; l'utilisateur courant vient toujours du token.

### Validation des entrées et des sorties
- `ValidationPipe` global avec `whitelist: true`, `forbidNonWhitelisted: true` et `transform: true` : tout champ non prévu est rejeté (protection contre le mass assignment).
- DTO stricts pour chaque entrée (types, longueurs max, formats : EAN-13, dates, quantités positives).
- **Ne jamais renvoyer une entité Prisma brute** : réponses construites explicitement (pas de `passwordHash`, de refresh token ni de champ interne dans les réponses).
- Prisma uniquement en requêtes paramétrées ; `$queryRawUnsafe` et `$executeRawUnsafe` interdits.
- Pagination obligatoire sur les listes, avec une taille maximale.

### Sécurité HTTP
- `helmet` pour les en-têtes de sécurité.
- CORS restreint à l'origine du front (liste blanche via variable d'environnement), jamais `*` avec des credentials.
- `@nestjs/throttler` en global, plus strict sur les routes sensibles.
- Limite de taille des requêtes (body parser).
- Filtre d'exception global : pas de stack trace ni de message d'erreur Prisma renvoyé au client en production.

### Appels externes (Open Food Facts, plus tard API d'IA)
- Les données d'une API externe sont **non fiables** : validées et nettoyées avant stockage (longueurs, types, URL d'image en `https` uniquement).
- Timeout et gestion d'erreur sur chaque appel ; l'appli reste utilisable si l'API est indisponible.
- Le code-barres est validé (format EAN, somme de contrôle) avant tout appel, et l'URL est construite proprement (pas de concaténation brute).
- V2 IA : clé d'API uniquement côté serveur, quotas par utilisateur, sortie du LLM validée par un schéma avant utilisation, attention à l'injection de prompt via les noms de produits.

### Données personnelles (RGPD)
- Minimisation : ne collecter que le nécessaire (email, mot de passe, données d'inventaire).
- Suppression de compte réelle (et des données associées) et export des données de l'utilisateur, prévus dans la feuille de route.
- Aucune donnée personnelle ni token dans les logs.

### Journalisation et supervision
- Logs structurés des événements de sécurité : connexions réussies et échouées, refresh, refus d'accès (403), dépassement de rate limit.
- Logs sans mot de passe, token, cookie ni contenu sensible.

### Docker et déploiement
- Dockerfile de production séparé, **multi-stage**, image minimale, exécution en **utilisateur non-root**.
- En production, PostgreSQL et Adminer ne sont pas exposés publiquement (Adminer uniquement en dev).
- HTTPS obligatoire derrière Nginx, avec HSTS.

### Dépendances et CI
- `npm audit` et Dependabot (ou Renovate) pour les vulnérabilités des dépendances.
- CI GitHub Actions : lint, tests, `npm audit --audit-level=high`, scan de secrets (gitleaks) et analyse statique (CodeQL).
- Versions des dépendances verrouillées (`package-lock.json` commité).

### Tests de sécurité
- Tests e2e dédiés à l'autorisation : un utilisateur ne peut ni lire, ni modifier, ni supprimer les données d'un autre foyer (tests IDOR systématiques).
- Tests sur l'authentification : token expiré, token invalide, refresh token réutilisé (doit être refusé et révoquer la session).
- Tests de validation : champs inconnus rejetés, entrées hors limites rejetées.

### Définition de terminé (checklist par fonctionnalité)
Avant de considérer une fonctionnalité terminée :
- [ ] Route protégée par défaut ; accès public justifié s'il y en a un.
- [ ] Appartenance au foyer vérifiée pour toute ressource liée à un foyer.
- [ ] DTO d'entrée stricts et réponse sans champ sensible.
- [ ] Tests unitaires de la logique + tests e2e d'autorisation (cas « autre foyer » refusé).
- [ ] Aucun secret, aucune donnée sensible dans le code ou les logs.
- [ ] `npm audit` sans vulnérabilité haute ou critique.

### Documentation
- Un fichier `SECURITY.md` à la racine décrit les mesures de sécurité en place et comment signaler une vulnérabilité.
- Le README contient une section « Sécurité » résumant les choix (utile pour les recruteurs).

## Feuille de route

1. **Environnement** : Docker Compose (PostgreSQL, Adminer, backend NestJS), Prisma initialisé.
2. **Socle de sécurité** (avant toute fonctionnalité) : validation des variables d'environnement, `helmet`, CORS restreint, `ValidationPipe` global strict, throttler global, filtre d'exception global, guard JWT global avec décorateur `@Public()`.
3. **Schéma Prisma de départ** (UUID partout) + `PrismaService` branché dans NestJS + première migration.
4. **Module `auth`** : inscription, connexion, argon2, access token court + refresh token en cookie `httpOnly` avec rotation, déconnexion, rate limiting renforcé, tests e2e.
5. **Module `pantry`** : CRUD des produits en saisie manuelle, tri par date de péremption, contrôle d'appartenance au foyer, tests IDOR.
6. **Module `products`** : récupération Open Food Facts par code-barres (validation EAN, timeout, nettoyage des données) + cache.
7. **Alertes** : job quotidien, une notification groupée par foyer (pas une par produit).
8. **Recettes V1** : base locale + algorithme de score.
9. **CI de sécurité** : lint, tests, `npm audit`, gitleaks, CodeQL, Dependabot. Rédaction de `SECURITY.md`.
10. **Front PWA** minimal : connexion, inventaire, ajout manuel, puis scan caméra (cookies `httpOnly`, pas de token dans le `localStorage`).
11. **Déploiement** : Dockerfile de production multi-stage non-root, HTTPS + HSTS derrière Nginx, BDD non exposée.
12. **V2** : foyer partagé avec rôles, statistiques de gaspillage, liste de courses, OCR de la date, recettes par IA, mode don, export et suppression des données (RGPD), vérification d'email.

Tester chaque module via l'API (Postman ou Bruno) avant de passer au suivant ; le front ne vient qu'après une API fonctionnelle de bout en bout.

## État actuel

Étapes 1 à 4 terminées.
- Socle de sécurité : variables d'environnement validées, helmet, CORS en liste blanche, corps JSON limité à 16 ko, ValidationPipe strict, rate limiting global (100 req/min) journalisé, filtre d'exception global, guard JWT global avec @Public().
- Base : schéma Prisma (User, Household, HouseholdMember, Product, PantryItem, RefreshToken), PrismaService global avec passwordHash exclu par défaut, base de test dédiée (miam_alert_test).
- Authentification : register (argon2id), login (access token 15 min + refresh token en cookie httpOnly), refresh avec rotation et détection de réutilisation, logout, GET /me, logs de sécurité en JSON. Routes /auth/* limitées à 10 req/min.
- 43 tests e2e.

Prochaine étape : module pantry (étape 5) — CRUD de l'inventaire filtré par foyer, tri par urgence, tests IDOR.



Mettre à jour cette section au fil de l'avancement.
