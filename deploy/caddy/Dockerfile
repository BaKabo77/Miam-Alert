# Reverse proxy de production (Caddy), recompilé et exécuté sans les droits root.

# ---------- 1. Compilation de Caddy ----------
# Le binaire de l'image officielle est compilé avec une version de Go et des bibliothèques qui
# peuvent avoir des failles connues (déni de service HTTP/2, validation des certificats...).
# On le recompile avec l'outil officiel xcaddy, un Go à jour et les dépendances corrigées :
# Trivy (pipeline) bloque le déploiement si une faille haute ou critique corrigible subsiste.
FROM golang:1.27.3-alpine AS build
ENV CGO_ENABLED=0
RUN go install github.com/caddyserver/xcaddy/cmd/xcaddy@v0.4.7
RUN xcaddy build v2.11.7 --output /caddy \
  --replace golang.org/x/net=golang.org/x/net@v0.62.0 \
  --replace github.com/go-jose/go-jose/v4=github.com/go-jose/go-jose/v4@v4.1.6

# ---------- 2. Image finale ----------
FROM caddy:2.11.7-alpine

# Paquets du système mis à jour : les correctifs de sécurité publiés depuis la construction de
# l'image de base sont appliqués. Puis utilisateur dédié, propriétaire des seuls dossiers où
# Caddy écrit (certificats, état).
RUN apk upgrade --no-cache \
  && addgroup -S caddy && adduser -S -D -H -G caddy caddy \
  && chown -R caddy:caddy /data /config

# Binaire recompilé. Copié sans « capability » : avec no-new-privileges (docker-compose.prod.yml),
# le noyau refuserait de lancer un binaire qui en réclame une ; l'ouverture des ports 80 et 443
# est autorisée par un réglage du compose (sysctl).
COPY --from=build /caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile

USER caddy
