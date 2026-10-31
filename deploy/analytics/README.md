# Mesure d'audience (Umami)

Statistiques de fréquentation **anonymes et sans cookie** : pages consultées, provenance, type d'appareil, et quelques actions clés. On sait **comment** l'application est utilisée, jamais **par qui**. Elles servent à valider l'usage avant l'offre Premium : les gens reviennent-ils ? Utilisent-ils le scan, les recettes ?

L'outil est [Umami](https://umami.is), **installé sur notre serveur** : aucune donnée ne part chez un tiers, et il n'y a pas de bandeau de consentement à afficher.

```
navigateur ──▶ miam-alert.fr (front)
    │  script.js et envoi des visites (publics)
    └────────▶ stats.miam-alert.fr ──▶ Caddy ──▶ stats (Umami, image durcie) ──▶ db : base « umami »
                       │                                                        (rôle « umami », séparé)
                       └── tableau de bord : mot de passe Caddy, PUIS mot de passe Umami
```

## Ce qui est mesuré, et ce qui ne l'est pas

| Mesuré | Jamais mesuré |
|---|---|
| Page (chemin seulement), site de provenance, navigateur, système, type d'appareil, langue, pays, région, ville | Adresse IP (elle sert à déduire la localisation, puis est oubliée), cookie, identifiant persistant |
| Événements : `signup`, `product-scanned`, `item-added`, `recipe-viewed`, `recipe-cooked` | Compte, email, nom de produit, contenu de l'inventaire, paramètres d'URL, fragment (les jetons des liens d'email y sont) |

## Les choix

| Choix | Pourquoi |
|---|---|
| Umami auto-hébergé | Léger (environ 150 Mo de mémoire), utilise le PostgreSQL déjà en place, données chez nous. Plausible auto-hébergé exige ClickHouse, trop lourd pour ce serveur |
| Exemption de consentement (CNIL) | Aucun cookie ni identifiant persistant, IP non conservée, localisation à la ville au plus, statistiques anonymes, aucun croisement avec d'autres sites, conservation limitée, opposition possible. Ces conditions **doivent rester vraies** : ne jamais ajouter d'identifiant de compte ni de donnée personnelle aux événements |
| Liste fermée d'événements, **sans donnée associée** | Type `AnalyticsEvent` (`frontend/src/lib/analytics.ts`) : impossible d'envoyer un email ou un nom de produit, le code ne compilerait pas |
| `data-exclude-search`, `data-exclude-hash`, `data-do-not-track` | Ni paramètres ni fragment envoyés ; réglage « Ne pas me pister » du navigateur respecté |
| Opposition par appareil | Bouton dans la politique de confidentialité (clé `umami.disabled` du stockage local, lue par le script d'Umami) |
| Rôle et base **séparés** (`stats-db-init`) | Umami a sa base et son rôle sans privilège ; le droit de connexion par défaut (`PUBLIC`) est retiré, si bien que le rôle `umami` ne peut **même pas se connecter** à la base de l'application (testé) |
| **Image durcie** ([`Dockerfile`](Dockerfile)) | L'image officielle 3.4.1 a 8 failles hautes corrigibles (Trivy). Corrigées : `apk upgrade` (curl), gestionnaires de paquets retirés (pnpm et son undici), pilote MySQL retiré (dépendance de la CLI Prisma inutile avec PostgreSQL), `deepmerge-ts` remplacé par la 8.0.2 (celle de notre backend) avec **vérification de son empreinte**. Résultat : 0 faille ; analysée par Trivy à chaque version, comme nos autres images |
| Conteneur non-root, **lecture seule**, sans aucune capacité | Comme les autres services (testé : Umami fonctionne ainsi) |
| Tableau de bord derrière un **second mot de passe** (Caddy) | Umami crée au premier démarrage un compte `admin` / `umami`. Caddy n'expose que `/script.js` et `/api/send` ; tout le reste exige un mot de passe vérifié **avant** d'atteindre Umami. Ni ce compte par défaut ni une faille de l'interface d'Umami ne sont exposés à Internet |
| Conservation de **13 mois** | Purge hebdomadaire ([`purge-stats.sql`](purge-stats.sql), [`miam-stats-purge.timer`](miam-stats-purge.timer)) : Umami ne supprime rien de lui-même |
| Pas de sauvegarde | Des statistiques perdues ne gênent personne ; la sauvegarde nocturne ne copie que la base de l'application |
| Filtre anti-robots d'Umami actif | Les navigateurs automatisés (`HeadlessChrome`…) ne faussent pas les chiffres. Pour un test automatisé, `DISABLE_BOT_CHECK=1` sur un Umami de test, **jamais en production** |

## Fichiers

| Fichier | Rôle |
|---|---|
| [`Dockerfile`](Dockerfile) | Image Umami durcie (construite et analysée par la CI : image `stats`) |
| [`init-umami-db.sh`](init-umami-db.sh) | Rôle et base `umami`, idempotent, lancé à chaque déploiement par le service `stats-db-init` |
| [`purge-stats.sql`](purge-stats.sql) | Suppression des statistiques de plus de 13 mois |
| [`miam-stats-purge.service`](miam-stats-purge.service), [`.timer`](miam-stats-purge.timer) | Purge chaque dimanche à 5 h (Paris) |

Ailleurs : services `stats-db-init` et `stats` de `docker-compose.prod.yml`, route `stats.{$DOMAIN}` du [Caddyfile](../caddy/Caddyfile), `frontend/src/lib/analytics.ts` (script et événements), `frontend/src/legal/AnalyticsChoice.tsx` (opposition), CSP du front (`frontend/nginx/security-headers.conf.template`).

## Mise en place (une fois)

La mise en service se fait en **deux versions** : la première installe Umami, la seconde active la mesure dans le front. L'identifiant du site n'existe qu'une fois Umami lancé.

### 1. DNS
Enregistrement **A** `stats` → IP du serveur (comme `@`, `www` et `api`). Caddy obtient le certificat HTTPS tout seul. L'enregistrement CAA existant (Let's Encrypt) couvre les sous-domaines.

### 2. Secrets dans `.env.prod` (serveur)

```bash
openssl rand -hex 32     # UMAMI_DB_PASSWORD
openssl rand -hex 32     # UMAMI_APP_SECRET
docker run --rm -it caddy:2.11.7-alpine caddy hash-password   # STATS_ADMIN_HASH : mot de passe demandé deux fois, masqué
```

Dans `.env.prod`, l'empreinte s'écrit **entre apostrophes** : elle contient des `$` que Docker Compose interpréterait sinon (vérifié : avec les apostrophes, elle arrive intacte dans le conteneur).

```
UMAMI_DB_PASSWORD=…
UMAMI_APP_SECRET=…
STATS_ADMIN_USER=kabo
STATS_ADMIN_HASH='$2a$14$…'
```

Sans ces variables, `docker compose` refuse de démarrer : c'est voulu.

### 3. Script de déploiement (serveur)
Le script télécharge désormais aussi l'image `stats` ; il faut réinstaller sa nouvelle version (voir [deploy/server/README.md](../server/README.md)) :

```bash
scp deploy/server/miam-deploy.sh miam-vps:/tmp/
ssh -t miam-vps 'sudo install -o root -g root -m 755 /tmp/miam-deploy.sh /usr/local/sbin/miam-deploy && rm /tmp/miam-deploy.sh'
```

### 4. Première version : Umami installé, front sans mesure
Publier la version et la déployer. Puis ouvrir https://stats.miam-alert.fr :
1. le mot de passe de Caddy (`STATS_ADMIN_USER` et celui choisi à l'étape 2) ;
2. le compte d'Umami `admin` / `umami` : **changer son mot de passe immédiatement** (*Settings → Profile*) ;
3. *Settings → Websites → Add website* : nom `Miam'Alert`, domaine `miam-alert.fr`. Copier son **identifiant** (UUID).

### 5. Deuxième version : la mesure activée
GitLab, *Settings → CI/CD → Variables* : `STATS_WEBSITE_ID` = l'identifiant du site. C'est une variable **visible** (ce n'est pas un secret : il se retrouve dans le code du front), **protégée** comme les autres. Publier une nouvelle version : le front est construit avec la mesure, et sa CSP autorise `https://stats.miam-alert.fr`.

### 6. Purge (serveur)

```bash
scp deploy/analytics/miam-stats-purge.{service,timer} miam-vps:/tmp/
ssh -t miam-vps
sudo install -o root -g root -m 644 /tmp/miam-stats-purge.service /tmp/miam-stats-purge.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now miam-stats-purge.timer
sudo systemctl start miam-stats-purge.service && sudo journalctl -u miam-stats-purge.service -n 5 --no-pager
rm /tmp/miam-stats-purge.*
```

## Commandes

```bash
# L'image durcie : construction et analyse, comme la CI
docker build -t miam-test/stats deploy/analytics
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.75.0 \
  image --severity HIGH,CRITICAL --ignore-unfixed miam-test/stats

# En production : le script est public, le tableau de bord exige le mot de passe de Caddy (401)
curl -sI https://stats.miam-alert.fr/script.js | head -1
curl -s -o /dev/null -w '%{http_code}\n' https://stats.miam-alert.fr/
```

**(serveur)** (`prod` : voir [docs/COMMANDES.md](../../docs/COMMANDES.md#production)) :

```bash
prod logs --tail 50 stats stats-db-init                               # démarrage, migrations d'Umami
prod exec db psql -U umami -d umami -c 'SELECT count(*) FROM website_event'   # volume des statistiques
systemctl list-timers miam-stats-purge.timer --no-pager               # prochaine purge
sudo journalctl -u miam-stats-purge.service -n 5 --no-pager           # dernière purge
```

## Mettre à jour Umami

1. Changer la version dans le `Dockerfile` (`FROM ghcr.io/umami-software/umami:<version>`), en suivant la règle du projet : une version d'au moins deux semaines, sauf correctif de sécurité. Les [notes de version](https://github.com/umami-software/umami/releases) le précisent.
2. Construire et analyser (commandes ci-dessus). Si une correction n'est plus utile (paquet mis à jour par Umami, chemin disparu), la retirer ; si une nouvelle faille apparaît, l'examiner de la même façon.
3. Vérifier que le script de mesure garde les options utilisées (`data-do-not-track`, `data-exclude-search`, `data-exclude-hash`, clé `umami.disabled`) :
   ```bash
   curl -s https://stats.miam-alert.fr/script.js | grep -o 'umami.disabled\|do-not-track\|exclude-search\|exclude-hash' | sort -u   # 4 lignes
   ```
4. Les migrations d'Umami s'appliquent seules à son démarrage, sur sa propre base.

## À savoir

- Le premier démarrage d'Umami crée le compte `admin` / `umami` : le mot de passe de Caddy le protège, mais il faut quand même le changer dès la première connexion (étape 4).
- Si Umami est arrêté ou en panne, l'application fonctionne normalement : le script ne se charge pas, et les appels de mesure ne font rien.
- La conservation de 13 mois est annoncée dans la politique de confidentialité : la changer impose de modifier les deux.
