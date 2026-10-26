# Reverse proxy de production (Caddy), dérivé de l'image officielle pour ne PAS tourner en root.
FROM caddy:2.10-alpine

# Utilisateur dédié, propriétaire des seuls dossiers où Caddy écrit (certificats, état).
RUN addgroup -S caddy && adduser -S -D -H -G caddy caddy \
  && chown -R caddy:caddy /data /config

# L'image officielle donne au binaire la capacité d'ouvrir les ports 80 et 443. Avec l'option
# no-new-privileges (docker-compose.prod.yml), le noyau refuserait de lancer un binaire qui réclame
# une capacité : on la retire, l'ouverture de ces ports est autorisée autrement (sysctl du compose).
RUN apk add --no-cache libcap && setcap -r /usr/bin/caddy && apk del libcap

COPY Caddyfile /etc/caddy/Caddyfile

USER caddy
