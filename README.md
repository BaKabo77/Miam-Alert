# Miam'Alert

Garde-manger anti-gaspi : suivi des produits alimentaires du foyer, alertes avant péremption et suggestions de recettes avec les produits les plus urgents.

> Projet en cours de construction. La sécurité est l'axe principal (security by design, OWASP Top 10 / API Security Top 10).

## Stack

NestJS 12 (TypeScript) · Prisma 7 · PostgreSQL 16 · Docker Compose · Vitest

## Démarrage (développement)

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env    # puis remplacer les valeurs factices
docker compose up -d --build
```

- API : http://localhost:3000
- Adminer : http://localhost:8080 (système PostgreSQL, serveur `db`)

Les commandes Prisma se lancent dans le conteneur :

```bash
docker compose exec backend npx prisma migrate dev --name <nom>
docker compose exec backend npm run test
```

## Sécurité (en place)

- Secrets uniquement dans `.env` (ignoré par git) ; `.env.example` ne contient que des valeurs factices.
- Services exposés sur `127.0.0.1` uniquement ; base de données non publiée hors du réseau Docker.
- Conteneur backend exécuté en utilisateur non-root.
- Dépendances verrouillées (`package-lock.json`, versions Prisma exactes), `npm audit` sans vulnérabilité.
- Scripts d'installation npm bloqués par défaut, autorisés nommément (`allowScripts`).

Le socle applicatif (validation des variables d'environnement, helmet, CORS, validation stricte, rate limiting, guard JWT global) arrive à l'étape suivante.
