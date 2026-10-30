# Briques transverses (`common`)

Le code partagé par plusieurs modules, la plupart du temps branché **globalement** dans [`app.module.ts`](../app.module.ts) ou [`main.ts`](../main.ts). Ces fichiers n'ont pas de route : ils s'appliquent à toutes.

## Fichiers

| Fichier | Rôle | Utilisé par |
|---|---|---|
| `validation.ts` | Crée le `ValidationPipe` global | `app.module.ts` |
| `validators.ts` | `@IsOptionalNotNull()` : champ facultatif, mais `null` refusé | DTO |
| `pagination.ts` | `PaginationQuery` (page, taille de 1 à 100) et type `Paginated<T>` | Listes (inventaire) |
| `throttling.ts` | Limites de débit : générale et par type de route | `app.module.ts`, controllers |
| `logging-throttler.guard.ts` | Guard de limite de débit qui journalise chaque dépassement | `app.module.ts` |
| `security-logger.ts` | Journal des événements de sécurité | Services |
| `all-exceptions.filter.ts` | Filtre d'exceptions global | `app.module.ts` |
| `trust-proxy.ts` | Réglage `trust proxy` d'Express | `main.ts` |
| `heartbeat.ts` | Signal de vie d'une tâche planifiée vers un service de surveillance | Alertes |

## Validation des entrées

Le `ValidationPipe` global :
- `whitelist` + `forbidNonWhitelisted` : un champ absent du DTO provoque une erreur **400**, au lieu d'être ignoré. Une tentative de *mass assignment* (envoyer `householdId` ou `status` pour les forcer) est donc visible ;
- `transform` : le corps devient une instance du DTO, avec ses valeurs par défaut ;
- **pas de conversion implicite** : `"123"` ne devient pas `123` sans un `@Type(() => Number)` explicite, nécessaire pour les paramètres d'URL.

`@IsOptionalNotNull()` existe parce que `@IsOptional()` laisse passer `null`. Prisma refuserait ensuite la valeur avec une erreur 500, au lieu d'un 400 clair.

## Limites de débit

Comptées **par IP** et par minute :

| Constante | Limite | Routes |
|---|---|---|
| `throttlerOptions` (défaut) | 100 | Toutes |
| `AUTH_THROTTLE` | 10 | `/auth/*`, `DELETE /me` (vérifient un mot de passe ou envoient un email) |
| `PRODUCTS_THROTTLE` | 30 | `GET /products/:barcode` (appel à Open Food Facts) |
| `EXPORT_THROTTLE` | 5 | `GET /me/export` |

Au-delà, la réponse est **429**, et l'événement `rate_limit.exceeded` est journalisé (une rafale sur `/auth/login` signale une attaque par force brute).

### Derrière le proxy

En production, toutes les connexions arrivent de Caddy. Sans réglage, tous les utilisateurs partageraient la même limite, et les journaux n'auraient jamais la vraie IP. L'IP réelle est dans `X-Forwarded-For`, mais **n'importe quel client peut envoyer cet en-tête**. `trust-proxy.ts` ne fait donc confiance qu'au **nombre exact** de proxys (`TRUST_PROXY=1`), jamais à `true`, qui accepterait une IP inventée et rendrait la limite contournable. Ce point est testé dans `test/throttling.e2e-spec.ts`.

## Journal de sécurité

`SecurityLogger` écrit **une ligne JSON par événement** (`{"event":"auth.login.failure","ip":"…"}`), facile à filtrer.

- Les événements possibles sont une liste fermée (type `SecurityEvent`).
- Les détails autorisés sont seulement `userId`, `ip` et `path` (type `SecurityEventDetails`). Il est **impossible** d'y glisser un email, un mot de passe, un token ou un cookie : le code ne compilerait pas.
- `test/security-logs.e2e-spec.ts` vérifie qu'aucun secret n'apparaît dans les journaux.

Ajouter un événement : l'ajouter à `SecurityEvent`, puis appeler `this.security.log(...)` (événement normal) ou `this.security.warn(...)` (événement suspect).

## Erreurs

`AllExceptionsFilter` :
- une erreur **voulue** (`HttpException` : 400, 401, 404, 429…) est renvoyée telle quelle ;
- une erreur **inattendue** (bug, erreur Prisma…) donne un 500 générique « Internal server error ». Le détail (pile d'appels) va dans les journaux du serveur, avec la méthode et le chemin, **jamais** le corps ni les en-têtes, qui contiendraient mots de passe, tokens et cookies.

## Signal de vie

`sendHeartbeat(url, 'success' | 'fail')` prévient un service comme healthchecks.io qu'une tâche planifiée s'est bien (ou mal) déroulée. Il ne lève jamais d'erreur : la surveillance ne doit pas faire échouer la tâche surveillée. L'URL n'est jamais journalisée, car elle contient l'identifiant secret du contrôle.

## Commandes

```bash
# Tests des briques transverses et de la configuration
docker compose exec backend npm test -- src/common src/config
docker compose exec backend npm run test:e2e -- validation throttling exceptions security-logs

# État de l'API (public)
curl -s http://localhost:3000/health

# Champ inconnu (mass assignment) : 400 avec le nom du champ refusé
curl -s http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"a@b.fr","password":"x","role":"admin"}' | jq .message

# Limite de débit : les 10 premiers passent (400), puis 429.
# Attention : bloque la connexion depuis ce poste pendant une minute.
for i in $(seq 1 12); do curl -s -o /dev/null -w '%{http_code} ' http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' -d '{}'; done; echo

# Tous les événements de sécurité (dev ; serveur : prod logs api | grep …)
docker compose logs backend | grep -E 'auth\.|rate_limit\.|household\.|account\.'
```

## Tests

- Unitaires : `heartbeat.spec.ts`.
- e2e : `validation` (champ inconnu, trop long, mauvais type), `throttling` (429, IP usurpée sans proxy ou par le client), `exceptions` (500 sans détail), `security-logs` (événements présents, aucun secret).
