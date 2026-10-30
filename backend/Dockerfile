# Image de PRODUCTION de l'API (l'image de développement est Dockerfile.dev).
# Construction en plusieurs étapes : les outils de compilation restent dans les étapes
# intermédiaires, l'image finale ne contient que le nécessaire pour exécuter l'API.

# ---------- 1. Dépendances complètes (pour compiler) ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Versions exactes du lockfile ; seuls les scripts d'installation autorisés (allowScripts) s'exécutent.
RUN npm ci

# ---------- 2. Compilation ----------
FROM deps AS build
COPY . .
# prisma.config.ts exige DATABASE_URL, mais "prisma generate" ne se connecte pas à la base :
# une valeur factice suffit, limitée à cette commande (aucun secret dans l'image).
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
  && npm run build

# ---------- 3. Base d'exécution, sans gestionnaire de paquets ----------
# L'API et les migrations sont lancées directement par node : les gestionnaires de paquets (npm,
# yarn, corepack) ne servent à rien en production et figurent parmi les premières sources
# d'alertes de sécurité (Trivy a relevé undici et brace-expansion vulnérables dans npm).
FROM node:24-alpine AS node-runtime
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

# ---------- 4. Dépendances des migrations ----------
# Production + CLI Prisma : la CLI est une dépendance « pair » facultative de @prisma/client
# (devOptional dans le lockfile), gardée par --omit=dev. Ni linter, ni compilateur NestJS, ni
# outils de test, qui n'ont rien à faire dans une image de production.
FROM node:24-alpine AS migrate-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- 5. Migrations de la base (lancées une fois avant chaque déploiement) ----------
FROM node-runtime AS migrate
WORKDIR /app
# Fichiers appartenant à root, lisibles par node : le conteneur ne peut pas modifier ses migrations.
COPY --from=migrate-deps /app/node_modules ./node_modules
COPY prisma.config.ts ./
COPY prisma ./prisma
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ---------- 6. Dépendances de production uniquement ----------
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# Ni outils de test, ni compilateur, ni CLI Prisma dans l'image finale : moins de code
# embarqué, moins de vulnérabilités possibles. La CLI Prisma et TypeScript sont déclarés par
# @prisma/client comme dépendances "pairs" facultatives : seul --omit=optional les retire.
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
# ...mais --omit=optional retire aussi le binaire natif d'argon2 (un paquet facultatif par
# plateforme) : on recopie celui de la plateforme de construction depuis l'installation complète.
COPY --from=deps /app/node_modules/@node-rs ./node_modules/@node-rs

# ---------- 7. Image finale de l'API ----------
FROM node-runtime AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# L'API ne tourne jamais en root : en cas de faille, l'attaquant n'aurait pas les droits
# d'administration du conteneur.
USER node

EXPOSE 3000

# Docker vérifie régulièrement que l'API répond (et la redémarre via la politique de restart sinon).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]
