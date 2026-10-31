# Mesure d'audience (Umami), durcie. L'image officielle contient des failles hautes corrigibles
# (Trivy) : paquets Alpine en retard, gestionnaires de paquets inutiles à l'exécution, et deux
# dépendances de la CLI Prisma. On repart de l'image officielle et on corrige, comme pour Caddy.
# Trivy (pipeline) bloque le déploiement si une faille haute ou critique corrigible subsiste.

# ---------- 1. Dépendance corrigée ----------
# deepmerge-ts 7.1.5 (faille de pollution de prototype) est utilisé par la configuration de Prisma.
# Prisma lui-même est passé à la 8.x dans un correctif (notre backend utilise déjà la 8.0.2, voir
# backend/package-lock.json) : la substitution est compatible. Empreinte vérifiée : le paquet doit
# être exactement celui de notre lockfile.
FROM node:24-alpine AS fixes
WORKDIR /fixes
RUN npm pack deepmerge-ts@8.0.2 --silent \
  && echo "sha512-uqbvqLUMrc6p0MO+WBRtTxY55hmyh94WRwI5a++PZe54X+bfVh59FSN7uWCBCW1CCVjzjnrwzfI8zidE2obMMw==" > expected \
  && node -e "process.stdout.write('sha512-' + require('crypto').createHash('sha512').update(require('fs').readFileSync('deepmerge-ts-8.0.2.tgz')).digest('base64') + '\\n')" > actual \
  && cmp expected actual \
  && mkdir deepmerge-ts && tar -xzf deepmerge-ts-8.0.2.tgz -C deepmerge-ts --strip-components=1

# ---------- 2. Image finale ----------
FROM ghcr.io/umami-software/umami:3.4.1

USER root
# - Paquets du système mis à jour (curl, libcurl...).
# - Gestionnaires de paquets retirés (pnpm, corepack, yarn) : Umami est lancé directement par node,
#   et pnpm embarque un undici vulnérable.
# - Pilote MySQL retiré : dépendance de la CLI Prisma, chargée seulement pour une base MySQL ; la
#   nôtre est PostgreSQL.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/pn /usr/local/bin/pnx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    /app/node_modules/.pnpm/mysql2@* \
    /app/node_modules/.pnpm/deepmerge-ts@7.1.5/node_modules/deepmerge-ts

# Fichiers copiés sans --chown : ils appartiennent à root, Umami ne peut que les lire.
COPY --from=fixes /fixes/deepmerge-ts /app/node_modules/.pnpm/deepmerge-ts@7.1.5/node_modules/deepmerge-ts

# Retour à l'utilisateur non privé de l'image officielle.
USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/heartbeat || exit 1
