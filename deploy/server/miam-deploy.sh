#!/usr/bin/env bash
# Déploie une version de Miam'Alert (ex. v0.6.0) à partir des images construites et analysées par
# GitLab CI. Installé dans /usr/local/sbin/miam-deploy (root:root, 755).
#
# Appelé par le job « deploy » de GitLab, qui se connecte avec l'utilisateur `deploy`. La clé SSH
# de ce dernier est restreinte à une seule commande (authorized_keys), qui passe la version à ce
# script via sudo ; sudo n'accepte lui-même qu'un argument au format vX.Y.Z (sudoers).
# Aucun shell, aucune autre commande : une fuite de la clé de GitLab ne permet que de redéployer
# une version déjà publiée.
set -euo pipefail

REPO_DIR=/home/kabo/miam-alert
REPO_OWNER=kabo
REGISTRY=registry.gitlab.com/bakabo77/miam-alert
HEALTH_TIMEOUT_S=120

log() { echo "[miam-deploy] $*"; }

VERSION="${1:-}"
# Validation stricte, en plus de celle de sudoers : la valeur vient d'un client distant.
if [[ ! "$VERSION" =~ ^v[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  log "version invalide (attendu : vX.Y.Z)" >&2
  exit 2
fi

# Fichiers de la version (compose, Caddyfile) : le dépôt suit un tag, jamais une branche.
# Git est lancé avec le compte propriétaire du dépôt, pas en root.
sudo -u "$REPO_OWNER" git -C "$REPO_DIR" fetch --quiet --tags
if ! sudo -u "$REPO_OWNER" git -C "$REPO_DIR" rev-parse --verify --quiet "refs/tags/$VERSION^{commit}" >/dev/null; then
  log "tag $VERSION introuvable" >&2
  exit 3
fi
PREVIOUS=$(sudo -u "$REPO_OWNER" git -C "$REPO_DIR" describe --tags --always)
sudo -u "$REPO_OWNER" git -C "$REPO_DIR" -c advice.detachedHead=false checkout --quiet "refs/tags/$VERSION"
log "fichiers : $PREVIOUS -> $VERSION"

cd "$REPO_DIR"
export MIAM_REGISTRY="$REGISTRY" MIAM_VERSION="$VERSION"
compose() { docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"; }

# Images téléchargées depuis le registre (aucune construction sur le serveur), puis lancées.
# Les migrations de la base s'appliquent avant l'API (service migrate, dépendance du compose).
log "téléchargement des images $VERSION"
compose pull --quiet migrate api web stats proxy
log "démarrage"
compose up -d --no-build --remove-orphans

# Vérification : l'API doit redevenir « healthy » (elle teste aussi la base de données).
api=$(compose ps -q api)
for _ in $(seq 1 "$HEALTH_TIMEOUT_S"); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$api" 2>/dev/null || echo unknown)
  if [[ "$status" == healthy ]]; then
    log "version $VERSION en ligne"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 1
done

log "ÉCHEC : l'API n'est pas redevenue saine en ${HEALTH_TIMEOUT_S} s (version précédente : $PREVIOUS)" >&2
log "retour arrière : relancer le déploiement de $PREVIOUS" >&2
exit 1
