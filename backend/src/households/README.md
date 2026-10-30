# Foyers et contrôle d'accès (`households`)

L'inventaire et les alertes n'appartiennent pas à un utilisateur mais à un **foyer** (`Household`). En V1, chaque compte a un seul foyer, créé à l'inscription, dont il est `OWNER`. Ce modèle prépare le foyer partagé de la V2 (plusieurs membres, rôles `OWNER` et `MEMBER`).

Ce module ne contient aucune route : il fournit **le contrôle d'appartenance** utilisé par tous les modules qui manipulent les données d'un foyer.

## Le risque : l'IDOR

Une IDOR (*Insecure Direct Object Reference*) consiste à accéder aux données d'un autre en changeant un identifiant dans l'URL : `/households/<foyer d'un autre>/pantry-items`. C'est le premier risque de l'OWASP API Security Top 10. Les UUID rendent les identifiants impossibles à deviner, mais **ne suffisent pas** : un identifiant peut fuiter. Chaque accès est donc vérifié.

## Les deux façons de vérifier

| Cas | Méthode | Exemple |
|---|---|---|
| Le **foyer** est dans l'URL | `HouseholdAccessService.assertMember(userId, householdId)` avant toute opération | `GET /households/:householdId/pantry-items`, `GET /households/:householdId/alerts/today` |
| Une **ressource** est dans l'URL (article, alerte), sans le foyer | Filtre dans la requête Prisma : `household: { members: { some: { userId } } }` | `PATCH /pantry-items/:itemId`, `POST /alerts/:alertId/read` |

Dans le second cas, le contrôle fait partie de la requête elle-même : l'article d'un autre foyer ne sort jamais de la base, il est simplement « introuvable ». Il n'y a pas de « lire puis vérifier » qu'on pourrait oublier.

Dans les deux cas :
- l'utilisateur vient **du token** (`@CurrentUser()`), jamais de la requête ;
- le refus donne **404**, pas 403 : un 403 confirmerait que la ressource existe. Un identifiant étranger et un identifiant inexistant reçoivent exactement la même réponse ;
- `assertMember` journalise `household.access_denied` (signe d'un parcours d'identifiants).

## Fichiers

| Fichier | Rôle |
|---|---|
| `household-access.service.ts` | `assertMember()` : le point de contrôle unique de l'appartenance |
| `households.module.ts` | Exporte le service, importé par `PantryModule` et `AlertsModule` |

## Tests

Les tests IDOR sont dans chaque module qui expose des données de foyer : `test/pantry-idor.e2e-spec.ts` (lister, ajouter, lire, modifier, supprimer chez un autre ; même réponse qu'un identifiant inexistant) et `test/alerts-api.e2e-spec.ts`. **Toute nouvelle route liée à un foyer doit avoir les siens.**

## Pour la V2 (foyer partagé)

- Les rôles sont déjà en base. Il faudra un guard ou une variante d'`assertMember` qui exige un rôle (par exemple `OWNER` pour inviter ou retirer un membre).
- `useHouseholdId()` côté front prend aujourd'hui le premier foyer : il faudra un sélecteur de foyer.
- La suppression de compte conserve déjà les foyers partagés pour leurs autres membres.
