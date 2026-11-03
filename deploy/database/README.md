# Rôles de la base de données

La base PostgreSQL de l'application est utilisée par **trois comptes**, chacun avec le minimum de droits nécessaire. Le superutilisateur créé par l'image PostgreSQL n'est plus jamais donné à l'API ni aux migrations.

| Rôle | Utilisé par | Peut | Ne peut pas |
|---|---|---|---|
| `POSTGRES_USER` (superutilisateur) | `db-init`, `stats-db-init`, sauvegarde nocturne, administration à la main | tout | — |
| `miam_owner` | conteneur `migrate` | créer et modifier les tables : il est propriétaire de la base et de ses objets | créer un rôle ou une base, lire les fichiers du serveur, lancer un programme (`COPY … PROGRAM`) |
| `miam_app` | l'API | lire, ajouter, modifier et supprimer des **lignes** | tout le reste : `DROP`, `ALTER`, `TRUNCATE`, `CREATE` (même temporaire), lire l'historique des migrations, se connecter à une autre base |

## Pourquoi

Jusqu'à la `v0.8`, l'API se connectait avec le superutilisateur. Une injection SQL, si une faille en introduisait une un jour, aurait alors donné :
- l'accès à toutes les bases, dont celle des statistiques ;
- la suppression de toutes les tables ;
- l'exécution de commandes dans le conteneur de la base (`COPY … TO PROGRAM`).

Avec `miam_app`, la même faille reste limitée aux lignes des tables de l'application. Les migrations, seules à modifier le schéma, ont leur propre rôle, qui n'a pas pour autant de droit d'administration.

## Fonctionnement

À chaque déploiement, le service `db-init` ([docker-compose.prod.yml](../../docker-compose.prod.yml)) lance [`init-app-db.sh`](init-app-db.sh) avec le superutilisateur, **avant** les migrations :

```
db (sain) ──▶ db-init (rôles et droits) ──▶ migrate (miam_owner) ──▶ api (miam_app)
```

Le script est **idempotent** : il peut tourner à chaque déploiement sans rien casser. Il :
1. crée `miam_owner` et `miam_app` s'ils manquent, puis réaffirme leurs attributs (aucun droit d'administration, même ajouté à la main) et leur mot de passe ;
2. donne la base à `miam_owner`. Il devient ainsi propriétaire du schéma `public` (rôle `pg_database_owner` de PostgreSQL 15+) ;
3. retire le droit de connexion par défaut (`PUBLIC`) à la base de l'application et aux bases d'administration (`postgres`, `template1`), puis l'accorde aux seuls `miam_owner` et `miam_app` ;
4. confie à `miam_owner` les tables et types créés autrefois par le superutilisateur (les index suivent leur table). C'est ce qui a permis la bascule de la production sans recréer la base ;
5. donne à `miam_app` les droits sur les lignes des tables existantes, et les mêmes **par défaut** sur les tables que créeront les futures migrations ;
6. retire à `miam_app` tout accès à `_prisma_migrations`.

## Fichiers

| Fichier | Rôle |
|---|---|
| [`init-app-db.sh`](init-app-db.sh) | Rôles, propriétaires et droits ; lancé par `db-init` en production et par le job `e2e` de la CI |

Ailleurs :
- variables `DB_OWNER_PASSWORD` et `DB_APP_PASSWORD` de [`.env.prod.example`](../../.env.prod.example) ;
- `DATABASE_URL_TEST_APP` dans [`backend/vitest.config.e2e.ts`](../../backend/vitest.config.e2e.ts).

## Tests

- **CI** : le job `e2e` lance ce même script sur sa base éphémère. Les migrations tournent en `miam_owner`, et l'application en `miam_app` (`DATABASE_URL_TEST_APP`). Si une modification de l'API exige plus de droits, elle échoue dans la CI, pas en production.
- **Vérifié à la main** lors de la mise en place :
  - bascule d'une base migrée par le superutilisateur, comme la production ;
  - double passage du script ;
  - nouvelle migration appliquée par `miam_owner` (colonne, table, valeur d'énumération), dont `miam_app` reçoit bien les droits ;
  - chacun des refus du tableau ci-dessus ;
  - toute la suite e2e en `miam_app` ;
  - contre-épreuve avec un mauvais mot de passe `miam_app` : échec ;
  - pile `db → db-init → migrate → api` du compose de production, sur une base neuve puis au déploiement suivant.

## Mise en place (une fois, pour une installation existante)

1. Sur le serveur, ajouter les deux mots de passe à `.env.prod`. Ils sont écrits directement dans le fichier, sans copier-coller :
   ```bash
   cd ~/miam-alert
   echo "DB_OWNER_PASSWORD=$(openssl rand -hex 32)" >> .env.prod
   echo "DB_APP_PASSWORD=$(openssl rand -hex 32)" >> .env.prod
   ```
2. Publier et déployer la version qui contient `db-init`. La bascule se fait seule au déploiement.

**Retour arrière** : redéployer la version précédente fonctionne sans rien défaire. Elle se connecte avec le superutilisateur, qui a accès à tout quel que soit le propriétaire des tables.

## Commandes

**(serveur)** (`prod` : voir [docs/COMMANDES.md](../../docs/COMMANDES.md#production)) :

```bash
prod logs db-init                                                                 # dernier passage du script
prod exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\du miam_*"'   # rôles : miam_owner et miam_app sans aucun attribut
# Connexions ouvertes par rôle : l'API doit apparaître en miam_app, jamais en superutilisateur
prod exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT usename, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1"'
```

**Changer un mot de passe** (rotation) : modifier `DB_OWNER_PASSWORD` ou `DB_APP_PASSWORD` dans `.env.prod`, puis redéployer la version en place. `db-init` applique le nouveau mot de passe, et l'API et `migrate` sont recréés avec la nouvelle adresse de connexion :

```bash
cd ~/miam-alert && sudo /usr/local/sbin/miam-deploy "$(git describe --tags)"
```

## À savoir

- **Une table créée à la main par le superutilisateur** (console SQL) n'appartient pas à `miam_owner` et n'est pas accessible à l'API jusqu'au prochain déploiement, qui la rattrape. Les changements de schéma passent par les migrations.
- **Après une restauration de sauvegarde** dans la base de production (`pg_restore --no-owner` avec le superutilisateur, voir [deploy/backup/](../backup/README.md)), les tables restaurées appartiennent au superutilisateur. Le redéploiement de la version en place (commande ci-dessus) remet propriétaires et droits en ordre.
- Une **nouvelle base installée de zéro** donne brièvement à `miam_app` un accès à `_prisma_migrations` : la table n'existe qu'après la première migration, et c'est le déploiement suivant qui retire cet accès.
- Les **mots de passe en hexadécimal** (`openssl rand -hex 32`) s'écrivent tels quels dans l'adresse de connexion. D'autres caractères (`@`, `/`, `:`) la casseraient.
- En **développement**, l'API utilise encore le compte de `.env` : `prisma migrate dev` doit pouvoir créer une base temporaire (*shadow database*), ce que `miam_owner` ne peut pas faire. Les droits de production sont vérifiés par la CI.
