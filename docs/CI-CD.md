# Intégration et déploiement continus

Le pipeline est défini dans [`.gitlab-ci.yml`](../.gitlab-ci.yml). Il garantit qu'aucun code n'est fusionné, et qu'aucune image n'est mise en production, sans avoir passé la qualité, les tests et les analyses de sécurité.

## Le dépôt et les branches

- `origin` = **GitLab**, la source de vérité. GitHub n'est qu'un miroir en lecture seule, mis à jour par GitLab : on n'y pousse jamais.
- `develop` (branche par défaut) et `main` (prête pour la production) sont **protégées** : personne ne pousse dessus directement.
- Chaque travail part de `develop` sur une branche `feat/…`, `fix/…`, `chore/…` ou `docs/…`, et revient par merge request : fusion en *fast-forward*, **pipeline vert obligatoire**.
- Les messages de commit commencent par `[ADD]`, `[EDIT]`, `[DELETE]` ou `[UPDATE]`.

## Quand le pipeline tourne

Une seule exécution par push (règles `workflow`) :
- sur une merge request : pipeline de MR ;
- sur une branche sans MR ouverte : pipeline de branche ;
- sur un **tag** `vX.Y.Z` : pipeline complet, avec la livraison.

Un nouveau push sur la même branche annule le pipeline devenu obsolète (`interruptible`), sauf le déploiement.

## Les jobs

| Étape | Job | Quand | Contenu |
|---|---|---|---|
| check | `quality` | toujours | API : lint (oxlint avec les types), compilation TypeScript, build, tests unitaires |
| check | `frontend` | toujours | Front : lint, compilation, build de production |
| test | `e2e` | toujours | Tests e2e de l'API sur un **PostgreSQL éphémère** et un **Mailpit** (faux serveur d'emails). `JWT_SECRET` est généré au hasard à chaque exécution |
| secret-detection | `secret_detection` | toujours | GitLab Secret Detection : aucun secret dans le code |
| security | `semgrep-sast` | toujours | GitLab SAST : analyse statique du code |
| security | `audit` (×2) | toujours | `npm audit --audit-level=high` sur l'API et le front (seul le lockfile est lu, rien n'est installé) |
| build | `build-images` | tags | Construit les 4 images (`api`, `migrate`, `web`, `proxy`) et les pousse dans le registre GitLab, avec le tag de la version |
| scan | `scan-images` (×4) | tags | **Trivy** : échec si une faille haute ou critique **disposant d'un correctif** subsiste, dans le système comme dans les dépendances |
| deploy | `deploy-production` | tags, **manuel** | Connexion SSH à l'utilisateur `deploy` du serveur, qui lance la version |

Un `npm audit` peut échouer sur un code qui n'a pas changé (faille publiée la veille) : c'est voulu, on corrige avant de fusionner.

## Où tournent les jobs

Sur un **runner GitLab installé sur le poste du développeur** (Docker Desktop), pas sur les machines partagées de GitLab.com : l'offre gratuite n'y donne que 400 minutes par mois. Deux runners :
- `miam-pc` : tous les jobs, sans aucun privilège ;
- `miam-pc-docker-build` : seulement `build-images` (tag `docker-build`), seulement sur les tags protégés, seulement avec les images Docker officielles.

Quand le poste est éteint, les pipelines attendent. Détails, sécurité et installation : [deploy/runner/README.md](../deploy/runner/README.md).

## Publier une version

1. MR de la branche de travail vers `develop` (pipeline vert).
2. MR de `develop` vers `main`.
3. Tag annoté sur `main`, au format des précédents :
   ```bash
   git switch main && git pull --ff-only origin main
   git tag -a vX.Y.Z -m "vX.Y.Z : résumé du contenu"
   git push origin vX.Y.Z
   ```
   Les tags `v*` sont protégés : seul le mainteneur peut en créer, et **un tag ne se déplace pas**. Une correction donne une nouvelle version.
4. Le pipeline du tag construit, analyse, puis attend.
5. Bouton ▶ de `deploy-production`. Sur le serveur, le script `miam-deploy` :
   1. récupère le tag dans le dépôt ;
   2. télécharge les 4 images de cette version ;
   3. applique les migrations (conteneur `migrate`), puis redémarre les services ;
   4. vérifie que l'API répond.

   Le serveur ne construit rien : il lance exactement ce qui a été testé et analysé.
6. Vérifier https://miam-alert.fr et https://api.miam-alert.fr/health, puis mettre à jour l'état d'avancement dans CLAUDE.md.

**Revenir en arrière** : relancer `deploy-production` dans le pipeline de la version précédente. Attention si une migration a modifié la base entre-temps : le retour en arrière du code ne défait pas la migration.

## Variables GitLab

*Settings → CI/CD → Variables*, toutes **protégées** (fournies seulement aux pipelines des tags protégés) :

| Variable | Type | Contenu |
|---|---|---|
| `DEPLOY_HOST` | Variable | IP du serveur |
| `DEPLOY_SSH_KEY` | **File** | Clé privée du job, **complète** (lignes `-----BEGIN…` et `-----END…` comprises) |
| `DEPLOY_KNOWN_HOSTS` | Variable | Ligne `known_hosts` du serveur (empreinte fixée : pas de confiance aveugle à la première connexion) |

Les identifiants du registre (`CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD`) sont fournis par GitLab à chaque job et valables le temps du job.

## Les barrières du déploiement

La clé SSH du job ne peut lancer **qu'une seule commande**, le script de déploiement, avec un numéro de version `vX.Y.Z` : c'est contrôlé par `authorized_keys`, par une règle sudo à expression régulière et par le script lui-même. Si cette clé fuyait, la seule action possible serait de redéployer une version déjà publiée et analysée. Détails : [deploy/server/README.md](../deploy/server/README.md).

## Pièges rencontrés

- **Disque plein** sur le runner (`ENOSPC`) : vider le cache de construction de Docker Desktop (voir [deploy/runner/README.md](../deploy/runner/README.md#exploitation)).
- **`Load key … error in libcrypto`** dans `deploy-production` : la clé de `DEPLOY_SSH_KEY` est incomplète ou a perdu son retour à la ligne final.
- Une image refusée par Trivy (comme `migrate` en `v0.6.0`) : on corrige l'image et on publie une nouvelle version, on n'ignore pas la faille.
