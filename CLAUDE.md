# Miam'Alert — garde-manger anti-gaspi

Application full-stack de suivi des produits alimentaires du foyer : l'utilisateur scanne ses courses, l'appli suit les dates de péremption, alerte avant qu'un produit périme et suggère des recettes avec les produits les plus urgents.

**Un vrai produit, destiné à être exploité** : lancement public gratuit (v1.0), puis une offre Premium par abonnement (recettes par IA, etc.), puis une application mobile sur les stores. Développé par un développeur full-stack orienté backend, seul pour l'instant ; l'application en ligne figure aussi dans son CV, mais c'est un bonus, pas l'objectif. Le code doit rester propre, lisible et bien structuré : il sera maintenu et enrichi pendant longtemps.

**La sécurité est l'axe principal du projet (security by design).** Elle n'est pas ajoutée à la fin : chaque fonctionnalité est conçue, codée et testée avec la sécurité en tête, en s'appuyant sur l'OWASP Top 10 et l'OWASP API Security Top 10. Le développeur a travaillé dans un environnement normé (HDS, ISO 27001) et veut que ce projet le démontre.

Règles pour Claude Code :
- Entre rapidité et sécurité, choisir la sécurité et expliquer brièvement pourquoi.
- Signaler toute faille repérée, même hors de la tâche en cours, sans la corriger en silence.
- Pour chaque nouvelle route : préciser qui a le droit d'y accéder et comment c'est vérifié.
- Expliquer les choix de sécurité au fil du code (commentaires courts sur le « pourquoi »), pour que le développeur puisse les justifier (audit, entretien, futur contributeur).
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
| Front | React 19 + Vite + TypeScript, Tailwind CSS 4, React Router, TanStack Query, PWA (vite-plugin-pwa) |
| Scan code-barres | `@zxing/browser` (EAN-13 / EAN-8) |
| Données produit | API Open Food Facts (gratuite) |
| Tâches planifiées | `@nestjs/schedule`, puis BullMQ + Redis si besoin |
| Environnement | Docker Compose : dev (db, adminer, backend, frontend), prod (`docker-compose.prod.yml`) |
| Dépôt et CI/CD | GitLab (GitLab CI), miroir en lecture seule vers GitHub |
| Production | VPS IONOS (UE, Ubuntu 24.04), reverse proxy Caddy (HTTPS Let's Encrypt), front servi par Nginx |

## Contraintes et décisions déjà prises

- **Pas de LLM local** (pas d'Ollama) : impossible à héberger pour ce projet.
- **Recettes, V1 sans IA** : base de recettes en BDD, ingrédients liés à des catégories, score par recette = ingrédients possédés pondérés par l'urgence de péremption.
- **Recettes par IA** (offre Premium) : API hébergée, **Mistral** de préférence (société française, traitement dans l'UE), en complément des recettes locales gratuites.
- Prévoir une interface `RecipeProvider` avec deux implémentations (`LocalRecipeProvider`, `AiRecipeProvider`) pour changer de source sans toucher au reste.
- **Un code-barres ne contient pas la date de péremption** : l'utilisateur la saisit. Rendre cette étape rapide (date suggérée selon la catégorie, raccourcis +3 j / +1 sem / +1 mois). OCR de la date en V2.
- **Distinguer DLC et DDM** (`expiryType`) : DLC = à respecter strictement, DDM = consommable après la date.
- **Cache des produits** : les infos Open Food Facts sont stockées dans la table `Product` (clé : `barcode` unique) au lieu d'appeler l'API à chaque fois.
- **`Household` dès le départ** : l'inventaire appartient à un foyer, pas à un utilisateur, même si la V1 n'a qu'un membre. Le partage en V2 sera ainsi simple.

### Produit et modèle économique
- **Lancer d'abord en gratuit** (v1.0) pour valider l'usage, puis ouvrir une **offre Premium** par abonnement. Contenu exact du Premium à définir (recettes par IA au minimum).
- **Paiement par Stripe** (Checkout et portail client) : aucune donnée de carte ne passe par nos serveurs (PCI-DSS porté par Stripe). Webhooks à signature vérifiée et traités de façon idempotente ; le statut d'abonnement est déterminé côté serveur, jamais par le front.
- **Coûts d'IA maîtrisés** : quotas par utilisateur et par offre, avant tout appel au modèle.
- **Cadre légal avant le payant** : statut (micro-entreprise envisagée, SIRET dans les mentions légales, qui disent aujourd'hui « sans but commercial »), CGU et CGV, droit de rétractation, médiateur de la consommation, factures.
- **Stores** : un abonnement vendu dans l'app mobile passe obligatoirement par l'achat intégré d'Apple et de Google (commission de 15 à 30 %), à prendre en compte dans les prix. L'auth par cookie devra avoir un mode « client mobile » (refresh token dans le stockage sécurisé du téléphone) ; référentiel de sécurité mobile : OWASP MASVS.
- **Mesure d'audience** uniquement sans cookie et respectueuse de la vie privée (Plausible ou Matomo auto-hébergés), pour éviter tout bandeau de consentement.

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
│   ├── Dockerfile      # image de production (multi-stage, non-root)
│   ├── Dockerfile.dev
│   ├── prisma/
│   └── src/
├── frontend/           # React (Vite), PWA ; Dockerfile + nginx/ pour la production
├── deploy/caddy/       # reverse proxy de production (Caddyfile, image non-root)
├── deploy/server/      # script de déploiement restreint du serveur
├── deploy/database/    # rôles de la base (miam_owner pour les migrations, miam_app limité aux lignes pour l'API)
├── deploy/backup/      # sauvegardes chiffrées
├── deploy/hardening/   # durcissement du serveur (redémarrage auto, sysctl, auditd, Lynis)
├── deploy/logship/     # envoi des journaux hors du serveur (archive B2 chiffrée, non modifiable)
├── deploy/analytics/   # mesure d'audience sans cookie (Umami auto-hébergé, image durcie, purge 13 mois)
├── deploy/runner/      # runner GitLab du poste de développement (modèles sans jeton)
├── docs/               # ARCHITECTURE.md (point d'entrée), COMMANDES.md, CI-CD.md, EVOLUTIONS.md, screenshots/
├── .gitlab-ci.yml      # pipeline : qualité, tests, sécurité ; sur tag : images, Trivy, déploiement
├── docker-compose.yml       # développement
├── docker-compose.prod.yml  # production
├── SECURITY.md
├── .env                # jamais commité
├── .env.example        # commité, valeurs factices
├── .env.prod.example   # modèle des secrets de production (le vrai .env.prod reste sur le serveur)
└── .gitignore
```

## Environnement

Tout tourne dans Docker. Le `.env` est à la racine ; dans `DATABASE_URL`, l'hôte est `db` (nom du service Docker), pas `localhost`.

```bash
docker compose up -d --build          # lancer
docker compose logs -f backend        # logs du backend
docker compose exec backend npx prisma migrate dev --name <nom>
docker compose exec backend npx prisma generate
docker compose exec backend npm run test
```

Les commandes Prisma se lancent **dans le conteneur** pour que l'hôte `db` soit résolu. Pour consulter la base : Adminer ou `docker compose exec db psql` (`prisma studio` est inutilisable, son port n'est pas publié). **Toutes les commandes** (dev, tests, dépendances, Git, runner, production, dépannage) sont dans `docs/COMMANDES.md`.

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

## Documentation de chaque partie

Chaque partie de l'application a un `README.md` dans son dossier : chaque module du backend (`backend/src/<module>/`), `backend/`, `backend/prisma/`, `frontend/`, chaque dossier de `deploy/`. Le point d'entrée est `docs/ARCHITECTURE.md` : vue d'ensemble, carte de toutes les documentations, trajet d'une requête, concepts clés. La chaîne CI/CD est décrite dans `docs/CI-CD.md`. **Toutes les commandes** importantes (installation, développement, base, tests, dépendances, Git, runner, production, dépannage) sont rassemblées dans `docs/COMMANDES.md`.

Public visé : **quelqu'un qui découvre le projet, ou le développeur qui n'y a pas touché depuis longtemps** et veut se rafraîchir la mémoire. Chaque README explique :
- le rôle de la partie et son fonctionnement général (les parcours, les flux) ;
- ses routes : qui y a accès et comment c'est vérifié ;
- ce que fait chaque fichier ;
- les choix importants, notamment de sécurité, et leur raison ;
- où sont les tests ;
- une section **« Commandes »** : les commandes propres à cette partie (tests ciblés, appels de ses routes avec `curl`, vérifications, exploitation en production), chacune essayée avant d'être écrite ;
- les pièges et ce qu'il faut savoir pour la modifier.

Règles :
- Toute modification qui change un comportement, une route, un fichier, une règle ou une commande met à jour le README de la partie concernée **dans le même commit**.
- Une nouvelle partie (module, dossier de `deploy/`…) arrive avec son README, ajouté au tableau de `docs/ARCHITECTURE.md`.
- Une commande ajoutée, modifiée ou devenue inutile (script npm, service Docker, procédure serveur) est reportée dans `docs/COMMANDES.md` dans le même commit. Chaque commande y est vérifiée avant d'être écrite.
- La documentation décrit ce que fait **réellement** le code : vérifier dans le code (et dans les tests) chaque affirmation avant de l'écrire. Pas de chiffres qui se périment (nombre de tests).
- En français, comme le reste de la documentation ; les noms de code restent en anglais.

## Workflow Git (GitLab)

- `origin` = GitLab (source de vérité), `github` = miroir en lecture seule, mis à jour automatiquement par GitLab. Ne jamais pousser directement sur GitHub.
- Branches permanentes protégées : `develop` (branche par défaut, intégration) et `main` (prêt pour la prod). Personne ne pousse dessus directement.
- Chaque travail part de `develop` sur une branche `feat/…`, `fix/…`, `chore/…` ou `docs/…`, poussée sur GitLab puis fusionnée par merge request (fast-forward, pipeline obligatoirement vert).
- Mise en production : MR `develop` → `main`, puis tag de version `vX.Y.Z` sur `main` (tags `v*` protégés).

## Sécurité

### Secrets et dépôt
- Ne jamais commiter `.env` ni aucun secret. Vérifier `git status` avant chaque commit.
- Le dépôt est privé (produit commercial) et n'a pas vocation à devenir public. L'historique doit quand même rester propre : si un secret fuit, le changer (rotation) plutôt que de réécrire l'historique.
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
- Minimisation : ne collecter que le nécessaire (email, mot de passe, données d'inventaire). Prénom et nom **facultatifs** (accueil, futur foyer partagé), modifiables et effaçables via `PATCH /me`. Pas de téléphone ni de date de naissance : aucun usage dans l'application.
- Suppression de compte réelle (et des données associées) et export des données de l'utilisateur, prévus dans la feuille de route.
- Aucune donnée personnelle ni token dans les logs.

### Journalisation et supervision
- Logs structurés des événements de sécurité : connexions réussies et échouées, refresh, refus d'accès (403), dépassement de rate limit.
- Logs sans mot de passe, token, cookie ni contenu sensible.

### Docker et déploiement
- Dockerfile de production séparé, **multi-stage**, image minimale, exécution en **utilisateur non-root**.
- En production, PostgreSQL et Adminer ne sont pas exposés publiquement (Adminer uniquement en dev).
- HTTPS obligatoire derrière le reverse proxy Caddy (Let's Encrypt, TLS 1.2+), avec HSTS. Enregistrement DNS CAA limité à Let's Encrypt.
- Conteneurs de production : non-root, lecture seule, `cap_drop: ALL`, `no-new-privileges`, chacun ne reçoit que ses variables. L'API fait confiance à un seul proxy (`TRUST_PROXY=1`, jamais `true`).

### Dépendances et CI
- `npm audit` pour les vulnérabilités ; Renovate pour les mises à jour des dépendances (prévu, pas encore en place).
- CI GitLab : lint, compilation, tests unitaires et e2e (PostgreSQL en service), `npm audit --audit-level=high`, détection de secrets (GitLab Secret Detection) et analyse statique (GitLab SAST).
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
- [ ] README de la partie concernée à jour (voir « Documentation de chaque partie »).

### Documentation
- Un fichier `SECURITY.md` à la racine décrit les mesures de sécurité en place et comment signaler une vulnérabilité.
- Le README contient une section « Sécurité » résumant les choix ; `docs/EVOLUTIONS.md` liste les évolutions possibles par priorité.
- Le fonctionnement détaillé de chaque partie est dans son propre `README.md` (voir « Documentation de chaque partie »).

## Feuille de route

### Fait
Environnement Docker, socle de sécurité, schéma Prisma, authentification, inventaire (IDOR testés), produits Open Food Facts, CI de sécurité, front PWA avec scan, alertes quotidiennes, mise en production durcie, sauvegardes chiffrées et immuables, pages légales, suppression du compte, export des données. Versions `v0.1.0` à `v0.4.0`.

### À venir
| Version | Contenu |
|---|---|
| `v0.4.1` | Changement de mot de passe (prêt, branche `feat/change-password`) |
| `v0.5` | Emails (Brevo, SPF/DKIM/DMARC) : mot de passe oublié (jeton à usage unique, haché, 30 min), vérification de l'email ; purge automatique des sessions expirées et des vieilles alertes |
| `v0.6` | Déploiement continu (images construites par GitLab CI, Trivy, registre GitLab, déploiement d'un tag par bouton via un utilisateur `deploy` limité au script), retour arrière ; supervision (disponibilité, sauvegardes, logs JSON) ; Renovate ; durcissement du serveur (redémarrage automatique après mise à jour du noyau, Lynis, sysctl, auditd) |
| `v0.7` | Recettes locales (base de recettes, ingrédients liés à des catégories, score selon l'urgence, interface `RecipeProvider`) ; date suggérée selon la catégorie |
| `v1.0` | **Lancement public gratuit** : CGU, contact de support, mesure d'audience sans cookie, foyer partagé, vérification finale complète |
| `v1.x` | Tests du front (client HTTP, session, parcours Playwright en CI) ; **Offre Premium** : statut et CGV, Stripe, recettes par IA avec quotas ; puis notifications push, statistiques de gaspillage, liste de courses, emplacements de stockage, OCR de la date |
| Ensuite | Application mobile (React Native) sur les stores |

Tester chaque module via l'API (Postman ou Bruno) avant de passer au suivant ; le front ne vient qu'après une API fonctionnelle de bout en bout.

## État actuel

Version `v0.4.0` en ligne sur https://miam-alert.fr (API sur api.miam-alert.fr). Versions : `v0.1.0` (API), `v0.2.0` (front PWA), `v0.3.0` (alertes, mise en ligne), `v0.3.1` (identité visuelle), `v0.3.2` (pages légales), `v0.4.0` (suppression du compte, export).
- Socle de sécurité, base, authentification, inventaire, produits, front PWA : voir README (40 tests unitaires, 141 e2e dont IDOR).
- Alertes (étape 7) : job quotidien à 9 h (Europe/Paris), une alerte par foyer et par jour (contrainte unique, idempotent), bandeau sur l'inventaire, `npm run alerts:generate`. Notifications push reportées.
- Front : style « fond blanc, composants colorés » (police Schibsted Grotesk auto-hébergée, tokens dans `src/index.css`, contrastes WCAG AA), pages légales publiques `/legal` et `/privacy` (infos éditeur dans `src/legal/publisher.ts`).
- RGPD : `DELETE /me` (mot de passe redemandé, 403 si faux, foyers dont l'utilisateur est seul membre supprimés avec inventaire et alertes) ; `GET /me/export` (JSON, champs explicites, sans hash ni identifiant interne, `no-store`, 5/min). Le cache TanStack Query est vidé à la fin de session.
- Production (étape 11) :
  - Images : `backend/Dockerfile` (cibles `runtime` et `migrate`), `frontend/Dockerfile` (Nginx unprivileged, CSP générée avec l'URL de l'API), `deploy/caddy/` (Caddy non-root).
  - `docker-compose.prod.yml` : db (réseau interne sans Internet), migrate (avant l'API), api, web, proxy (seul exposé, 80/443).
  - Serveur : VPS IONOS, alias SSH local `miam-vps` (clé dédiée), root et mots de passe interdits en SSH, ufw, fail2ban, mises à jour automatiques. Les commandes Docker passent par `sudo`, que seul le développeur lance.
  - Déploiement (manuel) : le serveur suit un tag, `git fetch --tags && git checkout vX.Y.Z`, puis `sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`.
  - Sauvegardes (`deploy/backup/`, voir son README) : chaque nuit à 3 h, pg_dump, restauration d'essai, chiffrement age (clé publique seule sur le serveur), copie locale 7 jours et Backblaze B2 UE 30 jours avec Object Lock (clé limitée à listBuckets + writeFiles).
- Pièges connus :
  - L'apostrophe du dossier `Miam'Alert` casse `npm run build` du front sur l'hôte (Workbox) : construire dans le conteneur.
  - Après un test de mutation (fichier modifié puis restauré), redémarrer le backend de dev : le compilateur en mode watch peut garder la version modifiée dans `dist/`.
  - Si SSH reste bloqué après « Server accepts key », l'agent GNOME attend le déverrouillage de la clé : `ssh-add ~/.ssh/miam-alert-vps` ou `-o IdentityAgent=none`.

Version `v0.5.0` en production : changement de mot de passe, date suggérée selon la catégorie, supervision (logs JSON, signal de vie des tâches), vérification de l'email (Brevo, domaine authentifié par DKIM, DMARC `p=none` pour commencer).

En cours (branche `feat/password-reset`) : mot de passe oublié (`POST /auth/forgot-password`, `POST /auth/reset-password`, pages `/forgot-password` et `/reset-password`). Jetons d'email factorisés dans `src/auth/email-tokens.ts` : émission atomique avec verrou `FOR UPDATE` sur le compte (la limite d'un email par minute n'est plus contournable par des requêtes simultanées), consommation à usage unique. 59 tests unitaires, 176 e2e.

Purge automatique (branche `feat/data-purge`, empilée sur `feat/password-reset`) : `src/maintenance/`, chaque nuit à 4 h (après la sauvegarde de 3 h), délais dans `RETENTION` (sessions 30 j après expiration, liens d'email 30 j après usage ou expiration, alertes 90 j), annoncés dans la politique de confidentialité.

Version `v0.5.1` en production (mot de passe oublié, purge nocturne).

Tag `v0.6.0` posé (déploiement continu), mais Trivy a bloqué le déploiement : l'image `migrate` héritait de toute l'étape de compilation (npm avec undici et brace-expansion vulnérables, oxlint compilé avec un Go vulnérable). Elle ne contient plus que les dépendances de production, la CLI Prisma, le schéma et les migrations, sans npm (1,26 Go → 170 Mo, 0 faille). Il ne restait aussi que 16 des 400 minutes mensuelles de CI de GitLab.com :
- Images de base mises à jour après une analyse Trivy de la production : le front (Nginx 1.28) et le proxy (Caddy 2.10) avaient 72 et ~100 failles hautes ou critiques corrigibles. Nginx 1.30 + `apk upgrade`, Caddy 2.11.7 **recompilé avec xcaddy** (Go 1.27.3, golang.org/x/net et go-jose à jour) : 0 faille sur les 4 images.
- Job `frontend` (lint, compilation, build) ajouté à la CI : il n'avait jamais existé, contrairement à ce qu'annonçait le README.
- Déploiement continu : sur tag `vX.Y.Z`, `build-images` (registre GitLab), `scan-images` (Trivy 0.75.0, bloquant), `deploy-production` (manuel, SSH vers l'utilisateur `deploy` limité au script `miam-deploy` par authorized_keys et par une règle sudo à expression régulière). `docker-compose.prod.yml` : images nommées `${MIAM_REGISTRY}/…:${MIAM_VERSION}` (défaut : construction locale). Installation : `deploy/server/README.md`.

En cours (branche `chore/local-runner`) : runner GitLab sur le poste du développeur (Docker Desktop), deux runners dans un conteneur `gitlab-runner` : `miam-pc` (jobs sans tag, non privilégié) et `miam-pc-docker-build` (protégé, tag `docker-build`, images `docker:*` seulement, seul le service dind privilégié). Runners partagés désactivés. Voir `deploy/runner/README.md`. Publication prévue en `v0.6.1`.

Durcissement du serveur appliqué le 2026-10-30 (`deploy/hardening/`, branche `chore/server-hardening`) : redémarrage automatique à 03:30 UTC si une mise à jour l'exige, sysctl (rp_filter strict, kptr_restrict 2, ptrace 2, BPF non privilégié interdit, kexec bloqué, aucun core dump, apport désactivé), modules dccp/sctp/rds/tipc/usb-storage interdits, SSH sans aucun transfert et LogLevel VERBOSE (00-hardening.conf désormais versionné), auditd (26 règles : commandes root des personnes, comptes, sudo, SSH, secrets, déploiement), permissions de cron et sshd_config réservées à root (dpkg-statoverride), bannière, profil Lynis des écarts acceptés. Lynis : 70 → 77+, aucun avertissement. Redémarrage contrôlé vérifié (tout se réapplique, l'application repart seule).

Journaux hors du serveur (branche `feat/log-shipping`, `deploy/logship/`) : toutes les 15 min, journald (système, conteneurs via le pilote `journald` de Docker, audit via le greffon syslog d'auditd) exporté depuis la dernière position, gzip + age (clé publique des sauvegardes), envoyé dans un bucket B2 dédié (Object Lock Compliance 180 jours, clé en écriture seule) ; position enregistrée après succès. Journal local : 30 jours, 2 Go. Politique de confidentialité mise à jour. Clôt la `v0.6` (publication `v0.6.2`).

En cours (branche `feat/local-recipes`, empilée sur `feat/log-shipping`) : recettes locales (`v0.7`). Backend fait : catalogue dans le code (`src/recipes/catalog/` : 71 ingrédients avec catégories OFF et mots-clés, 46 recettes rédigées pour le projet), recopié en base au démarrage (`RecipeCatalogSync`, empreinte dans `CatalogVersion`, une transaction) ; `PantryItem.ingredientKey` calculé par le serveur (catégorie OFF la plus précise, sinon mot-clé le plus long) ; classement par priorité (urgents sauvés, puis semaine, puis couverture, puis courses ; DLC dépassée jamais proposée) ; `RecipeProvider` + `LocalRecipeProvider` ; routes suggestions (membre du foyer) et détail. 83 tests unitaires, 194 e2e. Front fait : onglet Recettes (Inventaire | Scanner | Recettes, « Ajouter » déplacé sur l'inventaire), page des idées (8 puis « Voir d'autres idées »), fiche avec « J'ai cuisiné ça » (produits cochés passés en CONSUMED), idée de recette sur l'inventaire si un produit est urgent ; parcours vérifié dans Chromium (Playwright, Docker). Reste pour la `v0.7` : publier (MR, tag `v0.7.0`).

En cours (branche `feat/terms-and-support`, `v1.0`) : CGU (`/terms`, version `2026-10-31` dans `backend/src/users/terms.ts` ET `frontend/src/legal/terms.ts`, à changer ensemble), acceptation obligatoire à l'inscription (version vérifiée, date fixée par le serveur : `User.termsVersion`, `termsAcceptedAt`), `termsAccepted` dans `/me`, écran `TermsGate` pour une nouvelle version (`POST /me/terms-acceptance`), contact public `support@miam-alert.fr` (lien « Contact », profil « Aide et contact »). Mesure d'audience (même branche) : Umami 3.4.1 auto-hébergé, image durcie (`deploy/analytics/Dockerfile` : apk upgrade, pnpm et mysql2 retirés, deepmerge-ts 8.0.2 à empreinte vérifiée ; 0 faille Trivy), base et rôle `umami` séparés (`stats-db-init`, CONNECT retiré à PUBLIC), `stats.miam-alert.fr` : tout sauf `/script.js` et `/api/send` derrière une porte Caddy (`/gate` : `basic_auth` puis cookie secret `STATS_GATE_TOKEN` ; un `basic_auth` direct est incompatible avec l'en-tête `Authorization: Bearer` du front d'Umami), événements en liste fermée sans donnée, opposition par appareil (`umami.disabled`), purge 13 mois (timer). Mise en service en deux versions (voir `deploy/analytics/README.md`) : DNS `stats`, secrets `.env.prod`, réinstaller `miam-deploy`, puis variable CI `STATS_WEBSITE_ID`. Tests du front reportés après la `v1.0` (décision du 2026-10-31). Reste pour la `v1.0` : la vérification finale complète.

En attente côté serveur (fait par le développeur plus tard) : installer l'envoi des journaux (`deploy/logship/README.md`, bucket B2 + clé), puis publier `v0.6.2`.

Rôles de la base (branche `fix/db-least-privilege`, corrige le point signalé le 2026-10-31 : l'API utilisait le superutilisateur) : service `db-init` (`deploy/database/init-app-db.sh`, idempotent, avant `migrate`) ; `miam_owner` propriétaire de la base et des objets (migrations), `miam_app` limité aux lignes (API, sans accès à `_prisma_migrations`) ; connexion par défaut retirée à `PUBLIC` ; e2e de la CI en `miam_app` (`DATABASE_URL_TEST_APP`). Mise en service : `DB_OWNER_PASSWORD` et `DB_APP_PASSWORD` dans `.env.prod` avant le déploiement. Le dev garde le compte de `.env` (`migrate dev` crée une *shadow database*).

Version `v0.8.3` en production (2026-11-04) : rôles de la base appliqués, l'API se connecte en `miam_app` (vérifié).

Revue de sécurité des 22 routes faite le 2026-11-04 : aucune faille critique ; 8 constats (énumération par l'inscription, pas de limite par compte à la connexion, corps trop gros en 500 avant la limite de débit, `page` sans maximum, pas de plafond d'articles par foyer, taille de la réponse Open Food Facts, messages d'erreurs inattendues dans les journaux, CGU vérifiées par le front seulement) **reportés après la `v1.0`** à la demande du développeur, détaillés dans `docs/EVOLUTIONS.md` (« Revue de sécurité des routes »). Suite de la vérification finale : contrôle de la production vue de l'extérieur, cohérence des textes légaux, publication `v1.0.0`.

Foyer partagé (branche `feat/shared-household`, inclus dans la `v1.0`, décision du 2026-11-04) : `src/households/` ; invitations par lien (`HouseholdInvitation` : empreinte SHA-256, usage unique, 7 jours, 5 actives, 8 membres max), rôles `OWNER` (un seul par foyer) et `MEMBER` via `@RequireHouseholdRole` + `HouseholdRoleGuard` (404 non-membre, 403 membre), verrou `FOR UPDATE` sur le foyer, plusieurs foyers par compte (sélecteur dans l'en-tête, `miam.household` en stockage local), membres affichés par prénom sinon email, transfert automatique au membre le plus ancien si le propriétaire supprime son compte. CGU passées en version `2026-11-04` (nouvelle section « Foyer partagé » : chaque compte les accepte de nouveau) et politique de confidentialité mise à jour.

Suivi des liens par Brevo (constaté le 2026-11-06) : les liens des emails passent par `*.sendibt2.com`, qui enregistre les clics et conserve le lien avec son jeton. Risque accepté pour le lancement à la demande du développeur (usage unique, 30 min ou 24 h), annoncé dans la politique de confidentialité ; suivi anonymisé activé dans Brevo le 2026-11-08 (ouvertures et clics non rattachés au destinataire dans les journaux, liens toujours réécrits).

Reporté après la `v1.0` : changement de prestataire d'emails (Scaleway envisagé, voir `docs/EVOLUTIONS.md`), corrections de la revue de sécurité des routes (voir ci-dessus), tests automatisés du front (prévu : Vitest 5 + jsdom + Testing Library pour le client HTTP et la session, Playwright 1.64 en CI sur le runner avec l'image `mcr.microsoft.com/playwright:v1.64.1-noble`, qui embarque Node 24), normalisation de la clé de déploiement (branche `fix/deploy-key-format`), Renovate, durcissement de `miam-backup.service`, DMARC en `p=quarantine`, règles d'audit immuables (`-e 2`), alertes sur les événements de sécurité.

Mettre à jour cette section au fil de l'avancement.
