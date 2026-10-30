# Commandes

Toutes les commandes utiles pour installer, développer, tester, publier et exploiter Miam'Alert, rassemblées ici. Sauf mention contraire, elles se lancent **depuis la racine du dépôt, sur le poste de développement**.

- `docker compose exec backend …` exécute la commande **dans le conteneur** de l'API (même chose avec `frontend`). C'est obligatoire pour tout ce qui touche à la base : l'hôte `db` n'existe que dans le réseau Docker.
- Les commandes marquées **(serveur)** se lancent sur le serveur de production, après `ssh -t miam-vps`, dans `~/miam-alert`.

## Première installation (poste de développement)

Prérequis : Git, Docker et Docker Compose (Docker Desktop convient).

```bash
git clone git@gitlab.com:BaKabo77/miam-alert.git && cd miam-alert
cp .env.example .env
```

Remplir `.env` (jamais commité) en suivant ses commentaires :

```bash
openssl rand -base64 24 | tr -d '/+='   # mot de passe de la base (POSTGRES_PASSWORD, à reporter dans les deux URL)
openssl rand -base64 48                 # JWT_SECRET (32 caractères minimum)
```

Puis lancer et créer les tables :

```bash
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
```

| Service | Adresse |
|---|---|
| Application (Vite) | http://localhost:5173 |
| API | http://localhost:3000 (état : http://localhost:3000/health) |
| Emails capturés (Mailpit) | http://localhost:8025 |
| Base de données (Adminer) | http://localhost:8080 : système PostgreSQL, serveur `db`, identifiants du `.env` |

## Au quotidien

```bash
docker compose up -d                 # démarrer tout
docker compose ps                    # état des services
docker compose logs -f backend       # journaux de l'API (frontend, db, mailpit de même)
docker compose restart backend       # redémarrer l'API
docker compose stop                  # tout arrêter (les données sont conservées)
docker compose down                  # arrêter et supprimer les conteneurs (les données sont conservées)
```

Le code est monté dans les conteneurs : une modification est prise en compte à chaud, sans redémarrage.

⚠️ `docker compose down -v` **supprime aussi la base de dev** (volume `db-data`).

## Base de données

```bash
docker compose exec backend npx prisma migrate dev --name <nom>   # créer une migration après avoir modifié schema.prisma
docker compose exec backend npx prisma generate                  # régénérer le client Prisma
docker compose exec backend npx prisma migrate status            # migrations appliquées ou en attente
docker compose exec backend npx prisma validate                  # vérifier le schéma
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'   # console SQL
```

⚠️ `docker compose exec backend npx prisma migrate reset` **efface la base de dev** et la recrée (confirmation demandée).

Pour consulter les données, utiliser Adminer (http://localhost:8080) ou la console SQL. `prisma studio` n'est pas utilisable : son port n'est pas publié par `docker-compose.yml`.

Détails : [backend/prisma/README.md](../backend/prisma/README.md).

## Qualité et tests

API :

```bash
docker compose exec backend npm run lint          # oxlint (avec les types)
docker compose exec backend npx tsc --noEmit      # compilation TypeScript
docker compose exec backend npm test              # tests unitaires
docker compose exec backend npm run test:e2e      # tests e2e (base miam_alert_test, créée automatiquement)
docker compose exec backend npm run build         # build de production
docker compose exec backend npm audit --audit-level=high
```

Front (toujours dans le conteneur : l'apostrophe du dossier `Miam'Alert` fait échouer le build sur l'hôte) :

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run build        # compilation TypeScript + build de production
docker compose exec frontend npm audit --audit-level=high
```

C'est ce que vérifie la CI : lancer ces commandes avant de pousser évite un pipeline rouge.

Analyse Trivy d'une image en local, avec les mêmes options que la CI :

```bash
docker build -t miam-test/api --target runtime backend     # ou : --target migrate backend, frontend, deploy/caddy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.75.0 \
  image --severity HIGH,CRITICAL --ignore-unfixed miam-test/api
```

## Appeler l'API en dev

Pour tester une route à la main (outils : `curl` et `jq`). D'abord, un compte : créé dans l'application (http://localhost:5173) ou par `POST /auth/register` (voir [auth/](../backend/src/auth/README.md#commandes)). Puis, dans le terminal :

```bash
API=http://localhost:3000
read -rp 'Email : ' EMAIL; read -rsp 'Mot de passe : ' PASSWORD; echo   # saisie masquée, absente de l'historique
TOKEN=$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}' \
  | curl -s -c /tmp/miam-cookies.txt "$API/auth/login" -H 'Content-Type: application/json' -d @- | jq -r .accessToken)
HOUSEHOLD=$(curl -s "$API/me" -H "Authorization: Bearer $TOKEN" | jq -r '.households[0].id')
```

- `TOKEN` est valable 15 minutes : relancer la ligne `TOKEN=…` ensuite.
- Le cookie de session est gardé dans `/tmp/miam-cookies.txt` (pour `/auth/refresh` et `/auth/logout`).
- `jq -n` construit le JSON : un mot de passe contenant des guillemets ne casse pas la requête.
- Les limites de débit s'appliquent aussi en dev (10 requêtes par minute sur `/auth/*`).

Chaque README de module donne ensuite les appels de ses routes, dans sa section « Commandes ».

## Dépendances

```bash
docker compose exec backend npm install <paquet>         # ajoute à package.json et au lockfile (front : frontend)
docker compose exec backend npm install -D <paquet>      # dépendance de développement
docker compose exec backend npm install-scripts ls       # scripts d'installation en attente d'autorisation
docker compose exec backend npm install-scripts approve <paquet>   # autoriser, APRÈS avoir lu ce que fait le script
```

- npm 11 bloque les scripts d'installation : seuls ceux listés dans `allowScripts` (`package.json`) s'exécutent.
- Sur l'hôte, npm 11 est requis (`npx npm@11 install <paquet>`) : npm 10 plante sur l'arbre de dépendances de Vitest.
- Commiter `package.json` **et** `package-lock.json`.

Après un changement de dépendances fait hors du conteneur, ou une modification de `Dockerfile.dev`, reconstruire en renouvelant le volume des `node_modules` :

```bash
docker compose up -d --build --renew-anon-volumes backend    # ou frontend
```

## Tâches planifiées, à la main

```bash
docker compose exec backend npm run build
docker compose exec backend npm run alerts:generate     # alertes du jour (sans doublon si déjà faites)
```

La purge nocturne n'a pas de commande : elle tourne chaque nuit à 4 h.

## Git

```bash
git switch develop && git pull --ff-only origin develop
git switch -c feat/<sujet>                         # ou fix/, chore/, docs/
git status                                         # vérifier : jamais de .env ni de secret
git commit -m "[ADD] …"                           # [ADD], [EDIT], [DELETE] ou [UPDATE]
git push -u origin feat/<sujet>                    # puis merge request vers develop
```

Publier une version (après les MR vers `develop` puis vers `main`) :

```bash
git switch main && git pull --ff-only origin main
git tag -a vX.Y.Z -m "vX.Y.Z : résumé"
git push origin vX.Y.Z
```

Puis bouton ▶ `deploy-production` dans le pipeline du tag. Détails : [docs/CI-CD.md](CI-CD.md).

## Runner CI (poste de développement)

```bash
docker ps --filter name=gitlab-runner          # le runner tourne-t-il ?
docker logs -f gitlab-runner                   # jobs reçus et terminés
docker start gitlab-runner                     # le relancer
docker system df                               # place prise par Docker
docker builder prune -f                        # vider le cache de construction (disque plein, ENOSPC)
```

Ne pas lancer `gitlab-runner list` : cette commande affiche les jetons. Détails : [deploy/runner/README.md](../deploy/runner/README.md).

## Production

### Connexion et état

```bash
ssh -t miam-vps                                # clé dédiée ; si la connexion bloque : ssh-add ~/.ssh/miam-alert-vps
curl -s https://api.miam-alert.fr/health       # depuis n'importe où : {"status":"ok"}
```

**(serveur)** Raccourci à définir dans la session, puis commandes courantes :

```bash
cd ~/miam-alert
prod() { sudo docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"; }

git describe --tags          # version des fichiers en place
prod ps -a                   # état des 5 services (migrate : Exited (0), les autres : healthy)
prod logs -f --tail 100 api  # journaux de l'API (JSON) ; aussi web, proxy, db, migrate
prod restart api             # redémarrer un service, sans le recréer
```

⚠️ Ne **jamais** lancer `prod up` à la main : sans les variables du script de déploiement, Docker reconstruirait les images sur le serveur à la place de celles analysées par Trivy. Pour lancer une version, utiliser le script ci-dessous.

### Déployer et revenir en arrière

- **Normal** : bouton ▶ `deploy-production` du pipeline du tag dans GitLab.
- **Retour arrière** : bouton ▶ `deploy-production` du pipeline de la version précédente.
- **Secours, si GitLab est indisponible** (images déjà dans le registre) :
  ```bash
  ssh -t miam-vps 'sudo /usr/local/sbin/miam-deploy vX.Y.Z'
  ```

Détails : [deploy/server/README.md](../deploy/server/README.md).

### Sauvegardes

```bash
ssh -t miam-vps 'sudo journalctl -u miam-backup.service --since today --no-pager | tail -5'   # sauvegarde de cette nuit
ssh -t miam-vps 'systemctl list-timers miam-backup.timer --no-pager'                          # prochaine exécution
ssh -t miam-vps 'sudo systemctl start miam-backup.service'                                    # en lancer une maintenant
```

Restauration, clés et mise en place : [deploy/backup/README.md](../deploy/backup/README.md).

### Durcissement et audit

```bash
ssh -t miam-vps 'ls /var/run/reboot-required 2>/dev/null; last -x reboot | head -3'                       # redémarrage en attente, derniers redémarrages
ssh -t miam-vps 'sudo ausearch -k root_commands -ts today -i | grep -E "^type=EXECVE" | tail -20'    # commandes root du jour
ssh -t miam-vps 'sudo aureport --summary'                                                             # vue d'ensemble du journal d'audit
```

Toutes les commandes : [deploy/hardening/README.md](../deploy/hardening/README.md#commandes).

### Journaux hors du serveur

```bash
ssh -t miam-vps 'sudo journalctl -u miam-logship.service --since today --no-pager | tail -3'   # derniers envois
ssh -t miam-vps 'sudo journalctl -t miam-alert-prod-api-1 --since -1h'                         # journaux d'un conteneur
```

Consulter l'archive depuis le poste : [deploy/logship/README.md](../deploy/logship/README.md#consulter-les-journaux-poste-de-ladministrateur).

### Tâches planifiées de l'API

```bash
ssh -t miam-vps 'cd ~/miam-alert && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod logs --since 24h api | grep -E "Daily alerts|Purge"'
```

Résultat attendu : une ligne « Daily alerts » vers 9 h et une ligne « Purge » vers 4 h.

## Dépannage rapide

| Symptôme | Commande |
|---|---|
| L'API ne démarre pas en dev | `docker compose logs backend` : une variable manquante ou invalide est nommée dans l'erreur |
| Client Prisma introuvable (`…/generated/prisma`) | `docker compose exec backend npx prisma generate` |
| Une modification n'est pas prise en compte | `docker compose restart backend` (le dossier `dist/` est périmé) |
| Un paquet ajouté est introuvable dans le conteneur | `docker compose up -d --build --renew-anon-volumes backend` |
| `migrate dev` signale une dérive (*drift*) | Deux branches ont créé des migrations : les empiler, ou `prisma migrate reset` en dev |
| Un job de CI échoue avec `ENOSPC` | `docker builder prune -f` sur le poste du runner |
| `ssh miam-vps` reste bloqué après « Server accepts key » | `ssh-add ~/.ssh/miam-alert-vps` |
| Le site ne répond plus | `curl -sI https://miam-alert.fr`, puis **(serveur)** `prod ps -a` et `prod logs --tail 100 proxy api` |
