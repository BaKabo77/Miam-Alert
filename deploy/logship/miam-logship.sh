#!/usr/bin/env bash
# Envoi des journaux du serveur hors de celui-ci (lancé par miam-logship.timer, toutes les 15 min).
#
#   1. journal système (journald), depuis le dernier envoi. Il réunit tout : SSH, sudo, noyau,
#      services, les conteneurs de l'application (pilote « journald » de Docker) et le journal
#      d'audit (greffon syslog d'auditd)
#   2. compression et chiffrement avec age, avec la clé PUBLIQUE seulement : le serveur ne peut pas
#      relire ce qu'il a envoyé
#   3. envoi vers Backblaze B2 avec une clé en écriture seule, dans un bucket verrouillé (Object Lock) :
#      un intrus devenu root ne peut ni effacer ni modifier ce qui est déjà parti
#
# La position atteinte dans le journal n'est enregistrée qu'APRÈS un envoi réussi : en cas d'échec,
# le passage suivant renvoie tout ce qui manque (au pire un doublon, jamais un trou).
#
# Configuration : /etc/miam-logship/logship.env (voir logship.env.example), lisible par root seul.
set -euo pipefail
umask 077 # tout fichier créé ici n'est lisible que par root

# Surchargeables uniquement pour tester le script hors du serveur.
CONFIG=${MIAM_LOGSHIP_CONFIG:-/etc/miam-logship/logship.env}
STATE_DIR=${MIAM_LOGSHIP_STATE:-/var/lib/miam-logship}
JOURNAL_DIR=${MIAM_LOGSHIP_JOURNAL_DIR:-}

# shellcheck source=/dev/null
source "$CONFIG"
: "${AGE_RECIPIENT:?AGE_RECIPIENT manquant dans $CONFIG}"
: "${B2_BUCKET:?B2_BUCKET manquant dans $CONFIG}"
: "${B2_KEY_ID:?B2_KEY_ID manquant dans $CONFIG}"
: "${B2_APPLICATION_KEY:?B2_APPLICATION_KEY manquant dans $CONFIG}"
B2_S3_ENDPOINT=${B2_S3_ENDPOINT:-https://s3.eu-central-003.backblazeb2.com}
SERVER_NAME=${SERVER_NAME:-prod}

# Remote rclone "b2" décrit par variables d'environnement (aucun fichier de configuration), API
# compatible S3 de Backblaze (même raison que pour les sauvegardes, voir deploy/backup).
export RCLONE_CONFIG_B2_TYPE=s3 \
  RCLONE_CONFIG_B2_PROVIDER=Other \
  RCLONE_CONFIG_B2_ENDPOINT="$B2_S3_ENDPOINT" \
  RCLONE_CONFIG_B2_ACCESS_KEY_ID="$B2_KEY_ID" \
  RCLONE_CONFIG_B2_SECRET_ACCESS_KEY="$B2_APPLICATION_KEY"

log() { echo "[miam-logship] $*"; }

# Signale le résultat au service de surveillance (facultatif) : sans signal, il prévient par email.
ping_monitoring() {
  if [[ -n "${HEALTHCHECK_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECK_URL$1" || true
  fi
}

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
trap 'ping_monitoring /fail' ERR

mkdir -p "$STATE_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
# Un dossier par jour : on retrouve facilement les journaux d'une date donnée.
OBJECT="$SERVER_NAME/$(date -u +%Y/%m/%d)/$STAMP-journal.json.gz.age"

# ---------- 1. Journal système, depuis la dernière position ----------
# Une ligne JSON par entrée. journalctl lit la position dans --cursor-file et y écrit la nouvelle :
# on travaille sur une copie, qui ne remplace l'originale qu'après l'envoi.
# Premier passage (aucune position) : les dernières 24 h.
args=(--no-pager --output=json --cursor-file="$WORK/cursor")
[[ -n "$JOURNAL_DIR" ]] && args+=(--directory="$JOURNAL_DIR")
if [[ -s "$STATE_DIR/cursor" ]]; then
  cp "$STATE_DIR/cursor" "$WORK/cursor"
else
  args+=(--since=-24h)
fi
journalctl "${args[@]}" > "$WORK/journal.json"

if [[ ! -s "$WORK/journal.json" ]]; then
  log "rien de nouveau"
  ping_monitoring ""
  exit 0
fi

# ---------- 2. Compression et chiffrement ----------
gzip -9 < "$WORK/journal.json" | age --recipient "$AGE_RECIPIENT" > "$WORK/journal.json.gz.age"

# ---------- 3. Envoi ----------
# La clé B2 ne permet que d'écrire : les options évitent toute lecture, qui serait refusée
# (voir deploy/backup). La suppression après 6 mois est faite par Backblaze, jamais par ce serveur.
rclone copyto --no-check-dest --s3-no-check-bucket --s3-no-head --retries 3 \
  "$WORK/journal.json.gz.age" "b2:$B2_BUCKET/$OBJECT"

# Position enregistrée seulement maintenant, une fois l'envoi réussi.
mv "$WORK/cursor" "$STATE_DIR/cursor"

# Des tailles seulement dans le journal : jamais son contenu.
log "$(wc -l < "$WORK/journal.json") entrées envoyées ($(du -h "$WORK/journal.json.gz.age" | cut -f1) chiffrés) : $OBJECT"
ping_monitoring ""
