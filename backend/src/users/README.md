# Compte de l'utilisateur (`users`)

Tout ce qui concerne **son propre compte** : lire et modifier son profil, exporter ses données, supprimer son compte. Les routes sont sous `/me` et **n'acceptent aucun identifiant** : l'utilisateur est toujours celui du token. On ne peut donc agir que sur soi.

## Routes

| Route | Accès | Vérification | Réponse |
|---|---|---|---|
| `GET /me` | Connecté | Token | Profil : id, email, prénom, nom, `emailVerified`, `termsAccepted`, foyers (id, nom, rôle) |
| `PATCH /me` | Connecté | Token + DTO (prénom, nom) | Profil mis à jour |
| `GET /me/export` | Connecté, **5/min** | Token | Fichier JSON téléchargeable, `Cache-Control: no-store` |
| `POST /me/terms-acceptance` | Connecté | Token + `version` = version des CGU en vigueur | 204 ; 400 pour une autre version |
| `DELETE /me` | Connecté, **10/min** | Token + **mot de passe redemandé** | 204, cookie effacé ; **403** si le mot de passe est faux |

Si le compte a été supprimé alors que son access token est encore valide (15 min au plus), ces routes répondent 401.

## Profil (`GET` et `PATCH /me`)

- `GET /me` est la première route appelée par le front après la connexion : elle donne l'identité et le foyer à utiliser.
- Seuls le prénom et le nom sont modifiables ici. Tout autre champ est rejeté (protection contre le *mass assignment*). Le mot de passe a sa propre route (`/auth/change-password`).
- Prénom et nom sont **facultatifs** (minimisation RGPD), validés par [`person-name.ts`](person-name.ts) : une lettre, puis lettres, espaces, apostrophes, traits d'union ou points, 100 caractères au plus. Ni chiffres, ni balises, ni caractères de contrôle.
- À la modification, un champ **absent** est inchangé, un champ **vide ou `null`** est effacé (droit de rectification). À l'inscription, un champ vide est simplement ignoré.

## Conditions générales d'utilisation (CGU)

La version en vigueur est une constante, [`terms.ts`](terms.ts) : la date de la dernière modification du texte. Elle est à changer **en même temps** que le texte et la constante du front (`frontend/src/legal/terms.ts`).

- **Inscription** : le client envoie la version qu'il a affichée (case à cocher obligatoire). Toute autre version donne 400 et aucun compte n'est créé. Le serveur enregistre la version et la date (`termsVersion`, `termsAcceptedAt`) : c'est la **preuve d'acceptation**, que le client ne peut pas dater lui-même.
- **Nouvelle version** : `GET /me` renvoie `termsAccepted: false` ; le front affiche alors un écran d'acceptation avant toute autre page (voir [frontend/README.md](../../../frontend/README.md)). `POST /me/terms-acceptance` enregistre la nouvelle acceptation, et refuse une version périmée : une ancienne version de l'application, restée en cache, ne peut pas faire accepter un texte que l'utilisateur n'a pas vu.
- La version et la date d'acceptation figurent dans l'export ; l'événement `account.terms_accepted` est journalisé.

## Export des données (`GET /me/export`)

Droit d'accès et de portabilité (RGPD). Le fichier contient le compte, les foyers avec leur inventaire et leurs alertes, et les sessions (une entrée par connexion, pas par jeton).

- **Champs choisis un par un** (`EXPORT_SELECT`) : un champ ajouté plus tard au modèle n'apparaîtra dans l'export que si on l'ajoute ici, en connaissance de cause.
- **Absents volontairement** : le hash du mot de passe, les empreintes des jetons et les identifiants internes. Ils n'ont aucune utilité pour l'utilisateur et serviraient seulement un attaquant.
- Pas de pagination : c'est l'exception assumée à la règle des listes paginées (le droit d'accès porte sur **toutes** les données). Le volume reste celui d'un seul foyer, et la route est limitée à 5 appels par minute.

## Suppression du compte (`DELETE /me`)

Suppression **réelle** (droit à l'effacement), dans une transaction :
1. le mot de passe est vérifié (403 sinon : la session est valide, c'est la confirmation qui est refusée) ;
2. les foyers dont l'utilisateur est le **seul membre** sont supprimés, avec leur inventaire et leurs alertes (cascade). Un foyer partagé (V2) sera conservé pour ses autres membres ;
3. le compte est supprimé, avec ses sessions, ses appartenances et ses liens d'email (cascade).

Les données disparaissent ensuite des sauvegardes au bout de 30 jours au plus (durée de conservation des sauvegardes, annoncée dans la politique de confidentialité).

## Fichiers

| Fichier | Rôle |
|---|---|
| `users.controller.ts` | Les cinq routes ; en-têtes du téléchargement de l'export |
| `terms.ts` | Version des CGU en vigueur |
| `users.service.ts` | Lecture et mise à jour du profil, construction de l'export, suppression transactionnelle |
| `users.types.ts` | `MeResponse` et `DataExport` : ce qui sort de l'API, champ par champ |
| `person-name.ts` | Règles de validation des prénoms et noms (inscription et modification) |
| `dto/update-me.dto.ts` | Prénom et nom, effaçables |
| `dto/delete-me.dto.ts` | Mot de passe de confirmation |
| `dto/accept-terms.dto.ts` | Version des CGU acceptée (doit être celle en vigueur) |

## Commandes

Variables `API`, `TOKEN` et `HOUSEHOLD` : voir [Appeler l'API en dev](../../../docs/COMMANDES.md#appeler-lapi-en-dev).

```bash
# Tests du module (me, me-export, me-delete)
docker compose exec backend npm run test:e2e -- test/me

# Profil
curl -s "$API/me" -H "Authorization: Bearer $TOKEN" | jq

# Modifier le prénom, effacer le nom
curl -s -X PATCH "$API/me" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"firstName":"Marie","lastName":null}' | jq

# Export RGPD dans un fichier (données personnelles : le supprimer après lecture)
curl -s "$API/me/export" -H "Authorization: Bearer $TOKEN" -o export.json && jq 'keys' export.json && rm export.json

# Supprimer le compte (irréversible) : 204, ou 403 si le mot de passe est faux
jq -n --arg p "$PASSWORD" '{password:$p}' \
  | curl -s -X DELETE "$API/me" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d @- -w '%{http_code}\n'
```

## Tests

e2e : `me` (profil, noms acceptés et refusés, effacement), `me-export` (contenu complet, absence de champs sensibles, `no-store`, limite de débit), `me-delete` (mauvais mot de passe, foyers et données supprimés, sessions coupées).

## À savoir

- Un nouveau champ de données personnelles doit être ajouté à l'export **et** à la politique de confidentialité ([`frontend/src/pages/PrivacyPage.tsx`](../../../frontend/src/pages/PrivacyPage.tsx)).
- Journal de sécurité : `account.exported`, `account.deleted`, `account.delete.denied`.
