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

RUN npm run build \
  && mkdir /tmp/nginx \
  && for f in default.conf security-headers.conf; do \
       sed "s|__API_URL__|$VITE_API_URL|g" "nginx/$f.template" > "/tmp/nginx/$f"; \
     done

# ---------- 2. Image finale ----------
# Variante "unprivileged" de l'image officielle : Nginx tourne sous l'utilisateur nginx (uid 101)
# et écoute sur le port 8080, sans jamais passer par root.
FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime

# Fichiers copiés sans --chown : ils appartiennent à root et Nginx ne peut que les lire.
# Même en cas de faille, le processus ne pourrait pas modifier les pages servies.
COPY --from=build /tmp/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /tmp/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
