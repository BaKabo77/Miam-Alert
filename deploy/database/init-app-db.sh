#!/bin/sh
# Prépare les rôles de la base de l'application, lancé à chaque déploiement par le service db-init
# (docker-compose.prod.yml), AVANT les migrations. Idempotent : crée les rôles s'ils manquent,
# remet leurs mots de passe à jour (rotation possible) et réapplique propriétaires et droits.
#
# Principe du moindre privilège : le superutilisateur créé par l'image (POSTGRES_USER) ne sert plus
# qu'à l'administration (ce script, sauvegardes). Sinon, une injection SQL dans l'API donnerait
# tous les droits sur PostgreSQL, jusqu'à l'exécution de commandes dans le conteneur
# (COPY ... FROM PROGRAM, réservé aux superutilisateurs).
#   - miam_owner : propriétaire de la base et de ses objets ; utilisé par les migrations seulement.
#   - miam_app   : utilisé par l'API ; lit et écrit des LIGNES, ne peut rien créer, modifier ni
#                  supprimer dans le schéma (ni DROP, ni ALTER, ni TRUNCATE).
# Connexion avec le compte administrateur de PostgreSQL (variables PG* du service).
set -eu

psql -v ON_ERROR_STOP=1 -q -v owner_pw="$DB_OWNER_PASSWORD" -v app_pw="$DB_APP_PASSWORD" -v appdb="$PGDATABASE" <<'SQL'
SELECT 'CREATE ROLE miam_owner' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'miam_owner')\gexec
SELECT 'CREATE ROLE miam_app' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'miam_app')\gexec
-- Attributs réaffirmés à chaque déploiement : aucun droit d'administration, même ajouté à la main.
ALTER ROLE miam_owner WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'owner_pw';
ALTER ROLE miam_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_pw';

-- Propriétaire de la base : il devient aussi propriétaire du schéma public (rôle pg_database_owner,
-- PostgreSQL 15+), donc autorisé à y créer les tables des migrations.
ALTER DATABASE :"appdb" OWNER TO miam_owner;

-- Seuls ces deux rôles se connectent à la base (le droit par défaut de PUBLIC est retiré).
REVOKE ALL ON DATABASE :"appdb" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"appdb" TO miam_owner, miam_app;
-- Ni aux bases d'administration (vides, mais aucune raison d'y entrer). Le superutilisateur garde
-- son accès : les superutilisateurs ne sont pas soumis à ces droits.
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL

# La suite agit DANS la base de l'application (objets du schéma public).
psql -v ON_ERROR_STOP=1 -q <<'SQL'
-- Objets créés par les migrations passées, quand elles tournaient en superutilisateur : ils sont
-- confiés à miam_owner, sans quoi les prochaines migrations ne pourraient pas les modifier.
-- (REASSIGN OWNED est impossible ici : le superutilisateur de l'image possède aussi les objets
-- système.) Les index suivent leur table.
DO $$
DECLARE obj record;
BEGIN
  FOR obj IN
    SELECT format('ALTER %s %s OWNER TO miam_owner',
                  CASE c.relkind WHEN 'S' THEN 'SEQUENCE' WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,
                  c.oid::regclass) AS stmt
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
      AND c.relowner <> 'miam_owner'::regrole
      -- Séquence liée à une colonne : elle change de propriétaire avec sa table.
      AND NOT (c.relkind = 'S' AND EXISTS (SELECT FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a', 'i')))
    UNION ALL
    SELECT format('ALTER TYPE %s OWNER TO miam_owner', t.oid::regtype)
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd') AND t.typowner <> 'miam_owner'::regrole
  LOOP
    EXECUTE obj.stmt;
  END LOOP;
END
$$;

-- Personne d'autre ne crée d'objet dans le schéma (déjà le cas par défaut depuis PostgreSQL 15).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO miam_app;

-- Droits de l'API : lignes seulement, sur les tables existantes et sur celles des futures
-- migrations (droits par défaut des objets créés par miam_owner).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO miam_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO miam_app;
ALTER DEFAULT PRIVILEGES FOR ROLE miam_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO miam_app;
ALTER DEFAULT PRIVILEGES FOR ROLE miam_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO miam_app;

-- L'historique des migrations ne regarde que les migrations : l'API n'y a aucun accès. (Sur une
-- base neuve, la table n'existe qu'après la première migration : le déploiement suivant s'en charge.)
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON public._prisma_migrations FROM miam_app;
  END IF;
END
$$;
SQL

echo "[db-init] rôles miam_owner et miam_app prêts"
