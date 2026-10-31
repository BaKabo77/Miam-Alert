#!/bin/sh
# Prépare la base de la mesure d'audience, lancé à chaque déploiement par le service stats-db-init
# (docker-compose.prod.yml), avant Umami. Idempotent : ne crée le rôle et la base que s'ils manquent,
# et remet seulement le mot de passe à jour (rotation possible en changeant UMAMI_DB_PASSWORD).
#
# Umami a SON rôle et SA base : un Umami compromis ne peut ni lire ni modifier les données de
# l'application. Connexion avec le compte administrateur de PostgreSQL (variables PG* du service).
set -eu

psql -v ON_ERROR_STOP=1 -q -v pw="$UMAMI_DB_PASSWORD" -v appdb="$PGDATABASE" <<'SQL'
SELECT 'CREATE ROLE umami LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'umami')\gexec
ALTER ROLE umami WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'pw';
SELECT 'CREATE DATABASE umami OWNER umami' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec
-- PostgreSQL autorise par défaut tout rôle à se connecter à toute base (droit CONNECT de PUBLIC) :
-- on le retire, pour que le rôle umami ne puisse même pas se connecter à la base de l'application.
REVOKE CONNECT ON DATABASE :"appdb" FROM PUBLIC;
REVOKE CONNECT ON DATABASE umami FROM PUBLIC;
SQL

echo "[stats-db-init] base et rôle umami prêts"
