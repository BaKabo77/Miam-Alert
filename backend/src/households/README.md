# Foyers partagés et contrôle d'accès (`households`)

L'inventaire et les alertes n'appartiennent pas à un utilisateur mais à un **foyer** (`Household`). Chaque compte reçoit le sien à l'inscription, dont il est propriétaire (`OWNER`). Il peut y inviter d'autres personnes, qui deviennent membres (`MEMBER`), et rejoindre lui-même d'autres foyers : **un utilisateur peut appartenir à plusieurs foyers**. Le front permet de passer de l'un à l'autre.

Ce module fournit :
- **le contrôle d'appartenance et de rôle**, utilisé par tous les modules qui manipulent les données d'un foyer ;
- **la gestion du foyer** : membres, invitations, départ, transfert de la propriété.

## Les parcours

```
Marie (OWNER)                                   Paul
  │ POST /households/:id/invitations
  │   → lien https://miam-alert.fr/join#token=… (affiché une seule fois)
  │ ─────────── envoie le lien (SMS, messagerie…) ─────────▶ ouvre /join, se connecte si besoin
  │                                                          POST /household-invitations/preview
  │                                                            → « Rejoindre Coloc du 12 ? (invité par Marie) »
  │                                                          POST /household-invitations/accept
  │                                                            → Paul devient MEMBER ; le lien ne sert plus
```

- **Membres** : ils voient et modifient l'inventaire commun, les alertes et les recettes du foyer. Ils peuvent le quitter.
- **Propriétaire**, un seul par foyer : il renomme le foyer, invite, retire une invitation, retire un membre et peut transférer la propriété.
- **Règles qui gardent un état cohérent** :
  - le propriétaire transfère la propriété avant de partir ;
  - le dernier membre ne peut pas partir (le foyer resterait orphelin, avec son inventaire) ;
  - chacun garde au moins un foyer (l'application en a besoin pour fonctionner).
- **Suppression du compte du propriétaire** : la propriété passe au membre le plus ancien (voir [users/](../users/README.md#suppression-du-compte-delete-me)).

## Routes

| Route | Qui | Vérification |
|---|---|---|
| `GET /households/:householdId` | Membres | `assertMember` dans le service (404 sinon) |
| `PATCH /households/:householdId` | Propriétaire | `@RequireHouseholdRole('OWNER')`, guard (404 non-membre, 403 membre) |
| `POST /households/:householdId/invitations` | Propriétaire | Idem ; au plus 5 invitations actives et 8 membres (409 au-delà) |
| `GET /households/:householdId/invitations` | Propriétaire | Idem ; jamais le lien (il n'est pas conservé) |
| `DELETE /households/:householdId/invitations/:invitationId` | Propriétaire | Idem, plus un filtre sur le foyer dans la requête : l'invitation d'un autre foyer est introuvable (404) |
| `DELETE /households/:householdId/members/:userId` | Membres (soi-même = quitter) ; propriétaire (un autre membre) | Dans le service, sous verrou : non-membre 404, membre visant un autre 403, règles de départ 409 |
| `POST /households/:householdId/ownership` | Propriétaire | Guard, puis de nouveau dans la transaction |
| `POST /household-invitations/preview` | Tout utilisateur connecté qui détient le lien | Le jeton (corps de la requête) ; 10/min par IP |
| `POST /household-invitations/accept` | Idem | Idem ; usage unique, 409 si déjà membre (le lien n'est alors pas consommé) |

Toutes exigent un access token : aucune n'est `@Public()`.

## Le contrôle d'accès

### L'IDOR
Une IDOR (*Insecure Direct Object Reference*) consiste à accéder aux données d'un autre en changeant un identifiant dans l'URL : `/households/<foyer d'un autre>/pantry-items`. C'est le premier risque de l'OWASP API Security Top 10. Les UUID rendent les identifiants impossibles à deviner, mais **ne suffisent pas** : un identifiant peut fuiter. Chaque accès est donc vérifié.

| Cas | Méthode | Exemple |
|---|---|---|
| Le **foyer** est dans l'URL | `HouseholdAccessService.assertMember(userId, householdId)` avant toute opération | `GET /households/:householdId/pantry-items` |
| Une **ressource** est dans l'URL, sans le foyer | Filtre dans la requête Prisma : `household: { members: { some: { userId } } }` | `PATCH /pantry-items/:itemId`, `POST /alerts/:alertId/read` |
| Un **rôle** est exigé | `@RequireHouseholdRole('OWNER')` + `HouseholdRoleGuard` (appelle `assertRole`) | `POST /households/:householdId/invitations` |

Dans tous les cas :
- l'utilisateur vient **du token** (`@CurrentUser()`), jamais de la requête ;
- un non-membre reçoit **404**, pas 403 : un 403 confirmerait que le foyer existe. Un identifiant étranger et un identifiant inexistant reçoivent la même réponse ;
- un **membre** sans le rôle reçoit **403** : il sait déjà que le foyer existe, et le front peut expliquer le refus ;
- les refus sont journalisés (`household.access_denied`, `household.role_denied`).

Le guard s'exécute **avant** la validation des paramètres : il vérifie lui-même le format UUID de `:householdId` (400 sinon), pour ne jamais interroger la base avec un identifiant mal formé.

### Les invitations
- **Le lien est le secret** : 32 octets aléatoires. Seule l'empreinte SHA-256 est en base, le lien n'est montré qu'à sa création.
- **Usage unique** : la condition `usedAt: null` de la mise à jour ne laisse gagner qu'une acceptation, même simultanée (testé).
- **Durée de vie de 7 jours**. Un lien retiré est supprimé ; un lien utilisé ou expiré est purgé 30 jours plus tard ([maintenance/](../maintenance/README.md)).
- **Le jeton voyage dans le fragment** de l'URL du front (`/join#token=…`), que le navigateur n'envoie jamais au serveur, puis dans le **corps** d'un POST vers l'API : il n'apparaît dans aucun journal d'accès.
- **L'aperçu révèle le minimum** : le nom du foyer et le **prénom** de la personne qui invite, jamais son email (celui qui tient le lien n'est pas encore membre).
- **Limites** : 8 membres par foyer, 5 invitations actives. Un foyer reste un foyer, pas un groupe ouvert.

### Concurrence
Les opérations sur les membres (inviter, accepter, quitter, retirer, transférer) **verrouillent la ligne du foyer** (`SELECT … FOR UPDATE`) pendant leur transaction. Elles passent donc l'une après l'autre : deux acceptations simultanées ne dépassent pas la limite de membres, et un transfert ne croise pas un départ.

### Ce que les membres voient les uns des autres
Le **prénom et le nom** s'ils sont renseignés, sinon l'**adresse email** ([`member-name.ts`](member-name.ts)) : il faut bien pouvoir reconnaître la personne, mais l'email n'est montré que s'il n'y a rien d'autre. C'est annoncé dans la politique de confidentialité.

## Fichiers

| Fichier | Rôle |
|---|---|
| `household-access.service.ts` | `assertMember()` (renvoie le rôle) et `assertRole()` : le point de contrôle unique |
| `household-role.guard.ts` | `@RequireHouseholdRole()` et le guard qui l'applique |
| `households.controller.ts` | Routes du foyer (`/households/:householdId…`) |
| `household-invitations.controller.ts` | Aperçu et acceptation d'une invitation |
| `households.service.ts` | Logique : membres, invitations, départ, transfert ; limites `MAX_MEMBERS` et `MAX_ACTIVE_INVITATIONS` |
| `invitation-token.ts` | Génération et empreinte des jetons, durée de vie |
| `member-name.ts` | Nom affiché d'un membre (prénom, sinon email) |
| `households.types.ts` | Réponses, champ par champ |
| `dto/` | Nom du foyer (caractères autorisés, 100 max), jeton, membre visé par un transfert |
| `households.module.ts` | Exporte `HouseholdAccessService`, importé par l'inventaire, les alertes et les recettes |

## Tests

- `test/households.e2e-spec.ts` :
  - parcours complet et inventaire partagé ;
  - liens à usage unique, expirés ou mal formés ;
  - acceptations simultanées ;
  - chaque action du propriétaire refusée à un membre (403) ;
  - chaque route refusée à un non-membre, avec la même réponse qu'un foyer inexistant (404) ;
  - règles de départ, transfert, limites, suppression du compte du propriétaire.
- `member-name.spec.ts` : nom affiché.
- Les tests IDOR des autres modules : `test/pantry-idor.e2e-spec.ts`, `test/alerts-api.e2e-spec.ts`, `test/recipes.e2e-spec.ts`. **Toute nouvelle route liée à un foyer doit avoir les siens.**

## Commandes

Variables `API`, `TOKEN` et `HOUSEHOLD` : voir [Appeler l'API en dev](../../../docs/COMMANDES.md#appeler-lapi-en-dev).

```bash
docker compose exec backend npm run test:e2e -- households idor alerts-api   # contrôle d'accès

# Le foyer, ses membres et son propre rôle
curl -s "$API/households/$HOUSEHOLD" -H "Authorization: Bearer $TOKEN" | jq
# Renommer (propriétaire)
curl -s -X PATCH "$API/households/$HOUSEHOLD" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Coloc du 12"}' | jq .name
# Créer un lien d'invitation (propriétaire) : il ne sera plus jamais affiché
curl -s -X POST "$API/households/$HOUSEHOLD/invitations" -H "Authorization: Bearer $TOKEN" | jq -r .url
# Invitations encore utilisables
curl -s "$API/households/$HOUSEHOLD/invitations" -H "Authorization: Bearer $TOKEN" | jq

# Depuis un AUTRE compte (TOKEN de cet autre compte) : aperçu, puis acceptation
INVITE='<ce qui suit #token= dans le lien>'
jq -n --arg t "$INVITE" '{token:$t}' | curl -s "$API/household-invitations/preview" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d @- | jq
jq -n --arg t "$INVITE" '{token:$t}' | curl -s "$API/household-invitations/accept" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d @- | jq

# Quitter (son propre userId) ou retirer un membre (propriétaire) : userId lu dans .members
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "$API/households/$HOUSEHOLD/members/<userId>" \
  -H "Authorization: Bearer $TOKEN"

# Un foyer qui n'est pas le sien répond 404, exactement comme un foyer inexistant
curl -s -o /dev/null -w '%{http_code}\n' "$API/households/$(cat /proc/sys/kernel/random/uuid)" \
  -H "Authorization: Bearer $TOKEN"

# Événements du foyer (invitations, départs, refus) dans le journal de sécurité
docker compose logs backend | grep -E '"event":"household\.'
```

## À savoir

- **Une nouvelle action réservée au propriétaire** : `@RequireHouseholdRole('OWNER')` sur la route, plus un test « refusé à un membre » et « refusé à un non-membre » dans `households.e2e-spec.ts`.
- **Retirer un membre ne coupe pas son access token**, mais tous ses accès sont refusés immédiatement : l'appartenance est relue en base à chaque requête, elle n'est jamais dans le token.
- **Un foyer a toujours un seul propriétaire** : le transfert et la suppression du compte le maintiennent, et le test le vérifie (`count` des `OWNER`).
- Les limites (`MAX_MEMBERS`, `MAX_ACTIVE_INVITATIONS`) sont exportées : le front affiche `maxMembers` renvoyé par l'API, et les tests les importent.
