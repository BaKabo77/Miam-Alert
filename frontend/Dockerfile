# Image de PRODUCTION du front (l'image de développement est Dockerfile.dev).
# Node ne sert qu'à compiler : l'image finale est un Nginx qui sert des fichiers statiques,
# sans Node, sans npm, sans code source.

# ---------- 1. Compilation ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Versions exactes du lockfile ; seuls les scripts d'installation autorisés (allowScripts) s'exécutent.
RUN npm ci
COPY . .

# Adresse publique de l'API, inscrite dans le code JavaScript ET dans la CSP de Nginx.
# Ce n'est pas un secret (le navigateur la voit), mais elle est validée : une valeur malformée
# pourrait injecter des directives dans la configuration Nginx. HTTP n'est toléré que pour localhost.
ARG VITE_API_URL
RUN echo "$VITE_API_URL" | grep -Eq '^(https://[a-z0-9.-]+|http://localhost)(:[0-9]{1,5})?$' \
  || { echo "VITE_API_URL invalide : attendu https://api.exemple.fr (sans chemin ni / final)" >&2; exit 1; }

# Mesure d'audience (facultative) : adresse d'Umami et identifiant du site. Les deux ensemble ou
# aucun ; mêmes contrôles que pour l'API, puisque l'adresse est aussi inscrite dans la CSP.
ARG VITE_STATS_URL=""
ARG VITE_STATS_WEBSITE_ID=""
RUN if [ -n "$VITE_STATS_URL$VITE_STATS_WEBSITE_ID" ]; then \
      echo "$VITE_STATS_URL" | grep -Eq '^(https://[a-z0-9.-]+|http://localhost)(:[0-9]{1,5})?$' \
        || { echo "VITE_STATS_URL invalide : attendu https://stats.exemple.fr" >&2; exit 1; }; \
      echo "$VITE_STATS_WEBSITE_ID" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' \
        || { echo "VITE_STATS_WEBSITE_ID invalide : attendu l'identifiant (UUID) du site dans Umami" >&2; exit 1; }; \
    fi

RUN npm run build \
  && mkdir /tmp/nginx \
  && for f in default.conf security-headers.conf; do \
       sed -e "s|__API_URL__|$VITE_API_URL|g" -e "s|__STATS_URL__|$VITE_STATS_URL|g" "nginx/$f.template" > "/tmp/nginx/$f"; \
     done

# ---------- 2. Image finale ----------
# Variante "unprivileged" de l'image officielle : Nginx tourne sous l'utilisateur nginx (uid 101)
# et écoute sur le port 8080, sans jamais passer par root.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime

# Paquets du système mis à jour (correctifs publiés depuis la construction de l'image de base),
# puis retour immédiat à l'utilisateur non privé de l'image (nginx, uid 101).
USER root
RUN apk upgrade --no-cache
USER 101

# Fichiers copiés sans --chown : ils appartiennent à root et Nginx ne peut que les lire.
# Même en cas de faille, le processus ne pourrait pas modifier les pages servies.
COPY --from=build /tmp/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /tmp/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
