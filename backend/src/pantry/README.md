# Inventaire (`pantry`)

Les articles du garde-manger d'un foyer : ajout, liste triée par urgence, modification, changement de statut, suppression. C'est aussi ici qu'est défini le **calcul de l'urgence**, réutilisé par les alertes.

## Routes

Toutes protégées (access token). L'accès refusé ou l'identifiant inconnu donnent 404, sans distinction (voir [households/](../households/README.md)).

| Route | Vérification d'accès | Rôle |
|---|---|---|
| `POST /households/:householdId/pantry-items` | `assertMember` sur le foyer de l'URL | Ajoute un article (statut `ACTIVE`) |
| `GET /households/:householdId/pantry-items?status=&page=&pageSize=` | `assertMember` | Liste paginée (20 par défaut, 100 au plus), triée par urgence ; articles `ACTIVE` par défaut |
| `GET /pantry-items/:itemId` | Filtre « membre du foyer de l'article » dans la requête | Lit un article |
| `PATCH /pantry-items/:itemId` | Idem | Modifie les champs envoyés, dont le statut |
| `DELETE /pantry-items/:itemId` | Idem | Supprime l'article (204) |

Les identifiants de l'URL sont validés par `ParseUUIDPipe` (400 si malformés, avant la base).

## Un article

| Champ | Règles |
|---|---|
| `name` | 1 à 200 caractères, espaces retirés. Copié de la fiche produit ou saisi à la main |
| `quantity`, `unit` | Entier de 1 à 1 000 000 ; `PIECE`, `GRAM` ou `MILLILITER` (1 pièce par défaut) |
| `expiryDate` | `YYYY-MM-DD`, date réelle (le 30 février est refusé) |
| `expiryType` | `DLC` ou `DDM` |
| `status` | `ACTIVE`, `CONSUMED`, `WASTED`, `FROZEN` : modifiable seulement par `PATCH` |
| `productId` | Facultatif : lien vers la fiche produit d'un article scanné. Une fiche inconnue donne 400 |
| `ingredientKey` | **Jamais envoyé par le client** : l'ingrédient reconnu (fiche produit, sinon nom) est calculé par le serveur à la création et au renommage, pour les recettes (voir [recipes/](../recipes/README.md)) |

Ni `householdId` ni `status` ne sont acceptés à la création, et `householdId` n'est jamais modifiable : un article ne peut pas être déplacé vers un autre foyer. Le `ValidationPipe` rejette ces champs (protection contre le *mass assignment*).

La réponse ajoute deux champs **calculés par l'API** : `daysLeft` (jours restants, négatif si dépassé) et `urgency`, plus un résumé de la fiche produit (image, Nutri-Score) si l'article est lié à un produit.

## L'urgence

Calculée dans [`urgency.ts`](urgency.ts), à partir de la date, du type et du jour courant :

| Urgence | Condition | Affichage |
|---|---|---|
| `EXPIRED` | DLC dépassée | « Périmé » (à jeter) |
| `PAST_BEST_BEFORE` | DDM dépassée | « Date dépassée » (encore consommable) |
| `URGENT` | 0 à 2 jours restants (`URGENT_WITHIN_DAYS`) | « À consommer vite » |
| `SOON` | 3 à 7 jours (`SOON_WITHIN_DAYS`) | « Cette semaine » |
| `OK` | plus de 7 jours | « OK » |

**Tri de la liste** : date la plus proche d'abord ; à date égale, la DLC (stricte) passe avant la DDM (ordre de l'enum en base) ; puis par date d'ajout.

## Les dates

Une date de péremption n'a pas d'heure. Elle circule en `YYYY-MM-DD` et est stockée à **minuit UTC** (`@db.Date`), si bien que « périme le 20 » ne dépend ni du fuseau du serveur ni de celui de l'utilisateur. Les fonctions de [`dates.ts`](dates.ts) (`parseDateOnly`, `formatDateOnly`, `todayUtc`) sont utilisées partout où l'on manipule ces dates, alertes comprises.

## Fichiers

| Fichier | Rôle |
|---|---|
| `pantry.controller.ts` | Routes sur l'inventaire d'un foyer (`/households/:householdId/pantry-items`) |
| `pantry-item.controller.ts` | Routes sur un article (`/pantry-items/:itemId`) |
| `pantry.service.ts` | Logique et requêtes ; `accessibleItem()` = le filtre d'accès d'un article ; `P2025` (aucune ligne) traduit en 404 |
| `pantry.mapper.ts` | `PANTRY_ITEM_SELECT` (colonnes lues) et construction de la réponse (date formatée, urgence) |
| `pantry.types.ts` | `PantryItemResponse` : ce qui sort de l'API (ni `householdId`, ni dates techniques) |
| `urgency.ts` | Calcul de l'urgence et des jours restants (testé unitairement) |
| `dates.ts` | Dates sans heure |
| `dto/` | Création, modification partielle, filtres de la liste |

## Commandes

Variables `API`, `TOKEN` et `HOUSEHOLD` : voir [Appeler l'API en dev](../../../docs/COMMANDES.md#appeler-lapi-en-dev).

```bash
# Tests du module
docker compose exec backend npm test -- src/pantry
docker compose exec backend npm run test:e2e -- pantry

# Ajouter un article qui périme dans 3 jours ; ITEM garde son id pour la suite
ITEM=$(curl -s "$API/households/$HOUSEHOLD/pantry-items" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Yaourts\",\"quantity\":4,\"expiryDate\":\"$(date -d '+3 days' +%F)\",\"expiryType\":\"DLC\"}" | jq -r .id)

# Inventaire actif, trié par urgence
curl -s "$API/households/$HOUSEHOLD/pantry-items?pageSize=100" -H "Authorization: Bearer $TOKEN" \
  | jq '.items[] | {name, expiryDate, expiryType, urgency, daysLeft}'

# Marquer consommé (aussi : WASTED, FROZEN), puis voir l'historique
curl -s -X PATCH "$API/pantry-items/$ITEM" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"CONSUMED"}' | jq
curl -s "$API/households/$HOUSEHOLD/pantry-items?status=CONSUMED" -H "Authorization: Bearer $TOKEN" | jq '.total'

# Supprimer : 204
curl -s -X DELETE "$API/pantry-items/$ITEM" -H "Authorization: Bearer $TOKEN" -w '%{http_code}\n'
```

## Tests

- Unitaires : `urgency.spec.ts` (chaque seuil, DLC et DDM).
- e2e : `pantry` (création, validation, tri, pagination), `pantry-item` (lecture, modification partielle, statut, suppression), `pantry-product` (lien avec une fiche), **`pantry-idor`** (aucune action possible sur l'inventaire d'un autre foyer).

## À savoir

- Les statuts `CONSUMED` et `WASTED` alimenteront les statistiques de gaspillage (prévues) : on change le statut plutôt que de supprimer.
- Le front ne demande que la première page de 100 articles (voir [frontend/README.md](../../../frontend/README.md#limites-connues)).
- Changer un seuil d'urgence change aussi les alertes (même fonction) et les couleurs du front.
