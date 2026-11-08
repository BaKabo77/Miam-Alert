# Architecture de Miam'Alert

**Commencer ici.** Ce document donne la vue d'ensemble du projet et renvoie vers la documentation détaillée de chaque partie. Il s'adresse à quelqu'un qui découvre le code, ou qui n'y a pas touché depuis longtemps.

## Ce que fait l'application

Miam'Alert suit les produits alimentaires d'un foyer pour éviter le gaspillage :

1. l'utilisateur **scanne** le code-barres d'un produit (ou le saisit à la main) ;
2. l'application retrouve la fiche du produit (nom, photo, Nutri-Score) dans **Open Food Facts** et **suggère une date de péremption** selon sa catégorie ;
3. l'utilisateur confirme la date (le code-barres ne la contient pas) et son type : **DLC** (à respecter strictement) ou **DDM** (consommable après la date) ;
4. l'inventaire est **trié par urgence** : périmé, à manger vite, cette semaine, OK ;
5. chaque matin à 9 h, une **alerte** résume ce qui est périmé ou urgent ;
6. l'application **suggère des recettes** qui utilisent d'abord les produits les plus urgents ;
7. l'utilisateur marque chaque produit consommé, congelé ou jeté.

## Vue d'ensemble

```
                         Internet
                            │  (80/443 seulement)
                    ┌───────▼────────┐
                    │ proxy (Caddy)  │  HTTPS, HSTS, certificats Let's Encrypt
                    └───┬────────┬───┘
       miam-alert.fr    │        │   api.miam-alert.fr
              ┌─────────▼──┐  ┌──▼──────────────┐      ┌────────────────────┐
              │ web (Nginx)│  │ api (NestJS)    │─────▶│ Open Food Facts    │ fiches produits
              │ front React│  │                 │─────▶│ Brevo (SMTP)       │ emails
              │ compilé    │  │                 │─────▶│ healthchecks.io    │ signal de vie
              └────────────┘  └──┬──────────────┘      └────────────────────┘
                                 │ réseau interne, sans Internet
                          ┌──────▼───────┐
                          │ db (Postgres)│──▶ sauvegarde chiffrée chaque nuit (Backblaze B2)
                          └──────────────┘

   Mesure d'audience sans cookie : stats.miam-alert.fr ──▶ stats (Umami) ──▶ base « umami » séparée
   Journaux du serveur (système, audit, conteneurs) : 30 jours sur le serveur. Archive chiffrée et
   non modifiable toutes les 15 minutes (Backblaze B2, 6 mois) : prête, pas encore en service
```

- Le **navigateur** charge le front (fichiers statiques servis par Nginx), puis appelle l'API directement sur son sous-domaine.
- L'**API** est la seule à parler à la base. C'est elle qui applique toutes les règles de sécurité : le front n'est qu'une interface.
- La **base** n'a aucun port ouvert, et son réseau Docker n'a pas d'accès à Internet. L'API s'y connecte avec un rôle limité à la lecture et à l'écriture des lignes ([deploy/database/](../deploy/database/README.md)) ; seules les migrations modifient le schéma.

## Carte du dépôt et de la documentation

| Partie | Rôle | Documentation |
|---|---|---|
| `backend/` | API NestJS : socle, configuration, tests | [backend/README.md](../backend/README.md) |
| `backend/prisma/` | Modèle de données et migrations | [backend/prisma/README.md](../backend/prisma/README.md) |
| `backend/src/auth/` | Comptes, connexion, sessions, emails de vérification et de réinitialisation | [auth/README.md](../backend/src/auth/README.md) |
| `backend/src/users/` | Profil (`/me`), export RGPD, suppression du compte | [users/README.md](../backend/src/users/README.md) |
| `backend/src/households/` | Foyers partagés (membres, invitations, rôles) et contrôle d'appartenance (anti-IDOR) | [households/README.md](../backend/src/households/README.md) |
| `backend/src/pantry/` | Inventaire et calcul de l'urgence | [pantry/README.md](../backend/src/pantry/README.md) |
| `backend/src/products/` | Recherche par code-barres, Open Food Facts, date suggérée | [products/README.md](../backend/src/products/README.md) |
| `backend/src/alerts/` | Alerte quotidienne de 9 h | [alerts/README.md](../backend/src/alerts/README.md) |
| `backend/src/recipes/` | Suggestions de recettes selon l'urgence, catalogue de recettes | [recipes/README.md](../backend/src/recipes/README.md) |
| `backend/src/mail/` | Envoi des emails | [mail/README.md](../backend/src/mail/README.md) |
| `backend/src/maintenance/` | Purge nocturne des données devenues inutiles | [maintenance/README.md](../backend/src/maintenance/README.md) |
| `backend/src/common/` | Briques transverses (erreurs, limites de débit, journal de sécurité…) | [common/README.md](../backend/src/common/README.md) |
| `frontend/` | Application React (PWA), image Nginx de production | [frontend/README.md](../frontend/README.md) |
| `deploy/caddy/` | Reverse proxy de production | [deploy/caddy/README.md](../deploy/caddy/README.md) |
| `deploy/server/` | Script de déploiement du serveur | [deploy/server/README.md](../deploy/server/README.md) |
| `deploy/database/` | Rôles de la base : migrations et API sans superutilisateur, API limitée aux lignes | [deploy/database/README.md](../deploy/database/README.md) |
| `deploy/backup/` | Sauvegardes chiffrées | [deploy/backup/README.md](../deploy/backup/README.md) |
| `deploy/runner/` | Runner GitLab CI sur le poste de développement | [deploy/runner/README.md](../deploy/runner/README.md) |
| `deploy/hardening/` | Durcissement du serveur : redémarrage automatique, noyau, journal d'audit, Lynis | [deploy/hardening/README.md](../deploy/hardening/README.md) |
| `deploy/logship/` | Envoi des journaux hors du serveur (archive chiffrée et non modifiable) | [deploy/logship/README.md](../deploy/logship/README.md) |
| `deploy/analytics/` | Mesure d'audience sans cookie (Umami auto-hébergé, image durcie) | [deploy/analytics/README.md](../deploy/analytics/README.md) |
| `.gitlab-ci.yml` | Pipeline, publication d'une version | [docs/CI-CD.md](CI-CD.md) |
| Toutes les parties | Aide-mémoire de toutes les commandes : installation, développement, tests, publication, production | [docs/COMMANDES.md](COMMANDES.md) |

Autres documents : [README.md](../README.md) (présentation, résumé des choix de sécurité), [SECURITY.md](../SECURITY.md) (mesures par risque OWASP, signalement d'une faille), [docs/EVOLUTIONS.md](EVOLUTIONS.md) (évolutions possibles), [CLAUDE.md](../CLAUDE.md) (règles du projet, état d'avancement).

## Le trajet d'une requête

Exemple : l'utilisateur marque un yaourt comme consommé.

1. **Front** : le bouton appelle `updatePantryItemStatus()` ([pantry-api.ts](../frontend/src/pantry/pantry-api.ts)), qui passe par le client HTTP unique [lib/api.ts](../frontend/src/lib/api.ts). Celui-ci ajoute l'en-tête `Authorization: Bearer <access token>`.
2. **Caddy** termine le HTTPS et transmet à l'API, avec l'IP réelle du client dans `X-Forwarded-For`.
3. **API**, dans l'ordre :
   1. `helmet` (en-têtes de sécurité), lecture du corps JSON limitée à 16 ko, CORS ;
   2. guard de **limite de débit** (100 requêtes/min par IP, moins sur les routes sensibles) ;
   3. guard **JWT** : sans token valide, réponse 401, sauf sur une route marquée `@Public()` ;
   4. **ValidationPipe** : le corps est validé par le DTO, et tout champ inconnu donne une erreur 400 ;
   5. le **controller** récupère l'utilisateur depuis le token (`@CurrentUser()`), jamais depuis la requête ;
   6. le **service** interroge la base en filtrant par foyer : l'article d'un autre foyer est « introuvable » (404) ;
   7. la réponse est construite champ par champ, jamais une ligne brute de la base.
4. Si l'access token a expiré (15 min), le front reçoit 401, renouvelle la session avec le cookie de refresh, puis rejoue la requête.

## Concepts clés

| Terme | Sens |
|---|---|
| **Foyer** (`Household`) | Propriétaire de l'inventaire. Chaque compte en a un à l'inscription, dont il est propriétaire (`OWNER`). On y invite d'autres personnes par un lien à usage unique ; elles deviennent membres (`MEMBER`). Un compte peut appartenir à plusieurs foyers. |
| **DLC / DDM** | Date limite de consommation (stricte) / date de durabilité minimale (indicative). Une DLC dépassée donne « périmé », une DDM dépassée donne « date dépassée ». |
| **Urgence** | `EXPIRED`, `PAST_BEST_BEFORE`, `URGENT` (≤ 2 jours), `SOON` (≤ 7 jours), `OK`. Calculée par l'API, jamais par le front. |
| **Access token** | JWT de 15 minutes, gardé en mémoire par le front. |
| **Refresh token** | Jeton aléatoire de 7 jours, dans un cookie `httpOnly`. Il change à chaque usage (rotation). Il est stocké haché en base. |
| **Famille** | L'ensemble des refresh tokens d'une même connexion. La réutilisation d'un ancien jeton révoque toute la famille. |
| **IDOR** | Accès aux données d'un autre en changeant un identifiant dans l'URL. Empêché par le contrôle d'appartenance au foyer. |

## Environnements

| | Développement | Production |
|---|---|---|
| Fichier | `docker-compose.yml` | `docker-compose.prod.yml` |
| Services | `db`, `adminer`, `mailpit`, `backend` (rechargement à chaud), `frontend` (Vite) | `db`, `db-init` (rôles de la base), `migrate` (s'arrête après les migrations), `api`, `web`, `stats-db-init` et `stats` (mesure d'audience), `proxy` |
| Secrets | `.env` (modèle : `.env.example`) | `.env.prod` sur le serveur (modèle : `.env.prod.example`) |
| Emails | Mailpit, http://localhost:8025 (rien ne part) | Brevo |
| Accès | ports publiés sur `127.0.0.1` uniquement | seul Caddy est exposé (80/443) |

## Commandes

L'essentiel pour démarrer :

```bash
cp .env.example .env                                     # puis remplir les valeurs (voir les commentaires)
docker compose up -d --build                             # lancer l'environnement de dev
docker compose exec backend npx prisma migrate deploy    # créer les tables
docker compose exec backend npm test                     # tests unitaires
docker compose exec backend npm run test:e2e             # tests e2e
```

Toutes les autres (base de données, dépendances, qualité, Git, runner, production, dépannage) : **[docs/COMMANDES.md](COMMANDES.md)**.

## Où intervenir pour…

- **Ajouter une route** : voir la checklist de [backend/README.md](../backend/README.md#ajouter-une-route).
- **Ajouter un champ en base** : [backend/prisma/README.md](../backend/prisma/README.md#modifier-le-schéma).
- **Ajouter une page** : [frontend/README.md](../frontend/README.md#ajouter-une-page).
- **Publier une version** : [docs/CI-CD.md](CI-CD.md#publier-une-version).
- **Changer la durée de conservation d'une donnée** : `RETENTION` dans [maintenance/](../backend/src/maintenance/README.md), puis mettre à jour la politique de confidentialité.

## Tenir cette documentation à jour

Chaque partie a son `README.md`. Toute modification qui change un comportement, une route, un fichier ou une règle met à jour la documentation de la partie concernée **dans le même commit**. Une nouvelle partie arrive avec son propre README, référencé dans le tableau ci-dessus.
