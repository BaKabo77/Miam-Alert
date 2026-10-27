#!/usr/bin/env bash
# Sauvegarde quotidienne de la base de production de Miam'Alert (lancée par miam-backup.timer).
#
#   1. pg_dump de la base (copie cohérente, sans arrêter l'application)
#   2. restauration de test dans un PostgreSQL jetable, sans réseau : on ne garde que ce qui se restaure
#   3. chiffrement avec age, avec la clé PUBLIQUE seulement : le serveur ne peut pas relire ses sauvegardes
#   4. copie locale (7 jours) et envoi vers Backblaze B2 avec une clé en écriture seule (30 jours)
#
# Configuration : /etc/miam-backup/backup.env (voir backup.env.example), lisible par root seul.
set -euo pipefail
umask 077 # tout fichier créé ici n'est lisible que par root

# Surchargeables uniquement pour tester le script hors du serveur.
CONFIG=${MIAM_BACKUP_CONFIG:-/etc/miam-backup/backup.env}
BACKUP_DIR=${MIAM_BACKUP_DIR:-/var/backups/miam-alert}
LOCAL_RETENTION_DAYS=7
TEST_CONTAINER=miam-restore-test

# shellcheck source=/dev/null
source "$CONFIG"
: "${COMPOSE_DIR:?COMPOSE_DIR manquant dans $CONFIG}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT manquant dans $CONFIG}"
: "${B2_BUCKET:?B2_BUCKET manquant dans $CONFIG}"
: "${RCLONE_CONFIG_B2_ACCOUNT:?RCLONE_CONFIG_B2_ACCOUNT manquant dans $CONFIG}"
: "${RCLONE_CONFIG_B2_KEY:?RCLONE_CONFIG_B2_KEY manquant dans $CONFIG}"
export RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT RCLONE_CONFIG_B2_KEY

log() { echo "[miam-backup] $*"; }

compose() {
  docker compose -f "$COMPOSE_DIR/docker-compose.prod.yml" --env-file "$COMPOSE_DIR/.env.prod" "$@"
}

# Signale le résultat au service de surveillance (facultatif) : sans signal, il prévient par email.
ping_monitoring() {
  if [[ -n "${HEALTHCHECK_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECK_URL$1" || true
  fi
}

fail() {
  log "ÉCHEC : $*"
  ping_monitoring /fail
  exit 1
}

WORK=$(mktemp -d)
cleanup() {
  # La copie en clair ne survit jamais au script, même en cas d'erreur.
  rm -rf "$WORK"
  docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'ping_monitoring /fail' ERR

STAMP=$(date -u +%Y-%m-%dT%H%MZ)
FILE="miam-alert-$STAMP.dump.age"

# ---------- 1. Copie de la base ----------
# Format "custom" : compressé, restaurable table par table. Pas de propriétaire : la sauvegarde se
# restaure sur n'importe quel serveur PostgreSQL. Les variables sont lues DANS le conteneur de la
# base (guillemets simples voulus) : le mot de passe de la base ne passe jamais par ce script.
log "copie de la base"
# shellcheck disable=SC2016
compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$WORK/db.dump"

# ---------- 2. Restauration de test ----------
# Conteneur sans aucun réseau (--network none), supprimé à la fin. Mot de passe jetable.
log "restauration de test"
docker run -d --name "$TEST_CONTAINER" --network none \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$TEST_CONTAINER" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
sleep 2 # pg_isready répond pendant l'initialisation, avant le redémarrage final de PostgreSQL
docker cp "$WORK/db.dump" "$TEST_CONTAINER:/tmp/db.dump"
docker exec "$TEST_CONTAINER" pg_restore -U postgres -d postgres --exit-on-error --no-owner /tmp/db.dump

# Les migrations restaurées doivent être exactement celles de la production : la copie est complète.
count_migrations='SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
live=$(compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -At -c '$count_migrations'")
restored=$(docker exec "$TEST_CONTAINER" psql -U postgres -d postgres -At -c "$count_migrations")
[[ "$live" == "$restored" ]] || fail "$restored migrations restaurées sur $live"
# Des nombres seulement dans les logs : jamais de donnée personnelle.
users=$(docker exec "$TEST_CONTAINER" psql -U postgres -d postgres -At -c 'SELECT count(*) FROM "User"')
items=$(docker exec "$TEST_CONTAINER" psql -U postgres -d postgres -At -c 'SELECT count(*) FROM "PantryItem"')
log "restauration OK : $restored migrations, $users comptes, $items articles"

# ---------- 3. Chiffrement ----------
log "chiffrement"
mkdir -p "$BACKUP_DIR"
age --recipient "$AGE_RECIPIENT" --output "$BACKUP_DIR/$FILE" "$WORK/db.dump"

# ---------- 4. Copie externe ----------
# La clé B2 ne permet que d'écrire : pas de lecture, pas de suppression. --no-check-dest évite
# de lister le contenu du bucket (refusé) ; la suppression des anciennes copies est faite par
# une règle de cycle de vie de Backblaze, jamais par ce serveur.
log "envoi vers Backblaze B2"
rclone copyto --no-check-dest --retries 3 "$BACKUP_DIR/$FILE" "b2:$B2_BUCKET/$FILE"

# ---------- 5. Rotation locale ----------
find "$BACKUP_DIR" -name 'miam-alert-*.dump.age' -mtime +"$LOCAL_RETENTION_DAYS" -delete

log "terminé : $FILE ($(du -h "$BACKUP_DIR/$FILE" | cut -f1))"
ping_monitoring ""
