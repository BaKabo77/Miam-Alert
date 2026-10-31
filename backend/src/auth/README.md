# Authentification (`auth`)

Comptes, connexion, sessions, changement et réinitialisation du mot de passe, vérification de l'email. Ce module fournit aussi le **guard JWT global** et les décorateurs `@Public()` et `@CurrentUser()` utilisés par toute l'API.

## Les deux jetons

| | Access token | Refresh token |
|---|---|---|
| Nature | JWT signé HS256, contient seulement `sub` (l'id de l'utilisateur) | 32 octets aléatoires, ne contient rien |
| Durée | 15 minutes | 7 jours (renouvelés à chaque usage) |
| Transport | En-tête `Authorization: Bearer …` | Cookie `refresh_token` : `httpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth` |
| Côté front | En mémoire uniquement | Invisible pour JavaScript |
| En base | Rien | Empreinte SHA-256, famille, expiration, révocation |
| Révocable | Non (d'où sa courte durée) | Oui, immédiatement |

L'access token ne contient ni email ni foyer : il est lisible par n'importe qui (encodé, pas chiffré). Le foyer est toujours relu en base, si bien qu'un retrait du foyer prend effet tout de suite.

## Routes

Toutes sous `/auth`, limitées à **10 requêtes par minute et par IP**.

| Route | Accès | Vérification | Réponse |
|---|---|---|---|
| `POST /auth/register` | Public | DTO (email, mot de passe ≥ 12, noms facultatifs, `termsVersion` = version des CGU en vigueur) | 201 `{ id, email }` ; 409 si l'email existe ; 400 sans acceptation des CGU à jour |
| `POST /auth/login` | Public | Email + mot de passe (argon2) | 200 `{ accessToken }` + cookie ; 401 « Invalid credentials » |
| `POST /auth/refresh` | Public | Cookie de refresh, vérifié en base | 200 `{ accessToken }` + nouveau cookie ; 401 |
| `POST /auth/logout` | Public | Cookie de refresh (s'il est valide) | 204, cookie effacé, session révoquée |
| `POST /auth/change-password` | **Connecté** | Token + ancien mot de passe | 200 `{ accessToken }` + cookie ; **403** si l'ancien est faux |
| `POST /auth/verify-email` | Public | Jeton reçu par email (24 h, usage unique) | 204 ; 400 « Invalid or expired link » |
| `POST /auth/verify-email/resend` | **Connecté** | Token ; envoi à l'adresse du compte uniquement | 204 (un email par minute au plus) |
| `POST /auth/forgot-password` | Public | Aucune (réponse identique dans tous les cas) | 204, toujours |
| `POST /auth/reset-password` | Public | Jeton reçu par email (30 min, usage unique) | 204 ; 400 « Invalid or expired link » |

Pourquoi ces routes publiques : on ne peut pas exiger d'être connecté pour créer un compte, se connecter, renouveler un token expiré, se déconnecter avec un token expiré, ou ouvrir un lien d'email sur un autre appareil.

## Les parcours

### Inscription
1. Le mot de passe est haché **avant** de savoir si l'email existe : la réponse prend le même temps dans les deux cas.
2. Compte, foyer « Mon foyer » et appartenance `OWNER` sont créés **en une seule requête** : tout ou rien.
3. Un email déjà pris est détecté par la contrainte d'unicité de la base (code Prisma `P2002`), pas par une lecture préalable qui laisserait passer deux inscriptions simultanées.
4. Le lien de vérification part en arrière-plan : un serveur d'emails en panne ne fait pas échouer l'inscription.

### Connexion
- Si l'email est inconnu, on vérifie quand même un **hash factice** : le temps de réponse ne révèle pas quels comptes existent.
- Le message est le même pour un email inconnu et un mauvais mot de passe.
- Une connexion ouvre une nouvelle **famille** de refresh tokens, c'est-à-dire une session.

### Renouvellement (rotation)
1. Le cookie est vérifié : format exact, puis recherche par empreinte en base.
2. **Jeton déjà révoqué qui revient** : quelqu'un en a gardé une copie. On ne sait pas qui est le vrai utilisateur, donc **toute la famille est révoquée** (événement `auth.refresh.reuse_detected`). Il faudra se reconnecter avec le mot de passe.
3. L'ancien jeton est révoqué par un `updateMany … where revokedAt: null` : si deux requêtes présentent le même jeton en même temps, une seule gagne.
4. Un nouveau jeton est émis dans la même famille.

Côté front, un seul renouvellement à la fois (voir [frontend/README.md](../../../frontend/README.md)). Sinon, deux onglets déclencheraient cette détection de vol.

### Changement de mot de passe
L'ancien mot de passe est exigé. Le nouveau doit être différent. **Toutes** les sessions sont révoquées, puis une nouvelle est ouverte pour l'appareil courant. Le mauvais mot de passe donne **403** et non 401 : la session est valide, et un 401 ferait croire au front qu'elle a expiré.

### Vérification de l'email et mot de passe oublié
Les deux utilisent le même mécanisme de jetons ([`email-tokens.ts`](email-tokens.ts)) :
- 32 octets aléatoires ; seule l'empreinte SHA-256 est stockée ;
- **un seul jeton valable** par compte et par usage : en émettre un annule les précédents ;
- **un email par minute** au plus : la ligne du compte est verrouillée (`SELECT … FOR UPDATE`) pendant l'émission, donc des requêtes simultanées ne contournent pas la limite ;
- **usage unique**, garanti par un `updateMany … where usedAt: null` ;
- jeton placé dans le **fragment** de l'URL (`/reset-password#token=…`) : le navigateur ne l'envoie jamais au serveur, il n'apparaît dans aucun journal d'accès ;
- inconnu, expiré, déjà utilisé ou d'un autre usage : même réponse (400).

`forgot-password` répond **immédiatement et toujours 204**. Le travail réel (recherche du compte, jeton, email) se fait en arrière-plan, pour que ni la réponse ni son temps ne révèlent si l'adresse a un compte. Une réinitialisation réussie révoque toutes les sessions et marque l'email comme vérifié : ouvrir le lien prouve l'accès à la boîte.

## Fichiers

| Fichier | Rôle |
|---|---|
| `auth.controller.ts` | Les routes : lit le cookie, pose ou efface le cookie, délègue aux services |
| `auth.service.ts` | Inscription, connexion, rotation, déconnexion, changement de mot de passe |
| `email-verification.service.ts` | Envoi et vérification du lien de confirmation de l'email (24 h) |
| `password-reset.service.ts` | Demande et utilisation du lien de réinitialisation (30 min) |
| `email-tokens.ts` | Émission (verrou, limite d'envoi) et consommation (usage unique) des jetons d'email |
| `password.ts` | Hachage argon2id (19 Mio de mémoire, 2 passes) et vérification |
| `refresh-token.ts` | Génération et empreinte des refresh tokens, options du cookie, durée de 7 jours |
| `jwt.config.ts` | Access token de 15 min, algorithme HS256 **imposé** à la vérification (refuse `alg: none`) |
| `jwt-auth.guard.ts` | Guard global : laisse passer `@Public()`, sinon exige un `Bearer` valide et place `request.user` |
| `public.decorator.ts` | `@Public()` : seule façon d'ouvrir une route sans authentification |
| `current-user.decorator.ts` | `@CurrentUser()` : l'utilisateur issu du token vérifié, **seule** source d'identité |
| `refresh-token.decorator.ts` | `@RefreshTokenCookie()` : lit le cookie sur les seules routes qui en ont besoin |
| `auth.types.ts` | Contenu du JWT, types des réponses |
| `dto/` | Entrées validées : emails normalisés (minuscules, sans espaces), mots de passe de 12 à 128 caractères, jetons au format exact |

## Journal de sécurité

Événements émis (voir [common/](../common/README.md)) : `auth.register`, `auth.login.success`, `auth.login.failure` (avec l'IP, sans l'email), `auth.refresh`, `auth.refresh.reuse_detected`, `auth.logout`, `auth.password_changed`, `auth.password_change.denied`, `auth.email_verified`, `auth.email_verification.invalid`, `auth.password_reset.requested`, `auth.password_reset.invalid`, `auth.password_reset.completed`.

## Commandes

Variables `API`, `TOKEN` et `HOUSEHOLD` : voir [Appeler l'API en dev](../../../docs/COMMANDES.md#appeler-lapi-en-dev).

```bash
# Tests du module
docker compose exec backend npm run test:e2e -- auth- email-verification password-reset

# Créer un compte (le lien de vérification arrive dans Mailpit : http://localhost:8025)
jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}' \
  | curl -s "$API/auth/register" -H 'Content-Type: application/json' -d @-

# Renouveler la session : nouveau TOKEN, cookie remplacé (rotation)
TOKEN=$(curl -s -b /tmp/miam-cookies.txt -c /tmp/miam-cookies.txt -X POST "$API/auth/refresh" | jq -r .accessToken)

# Se déconnecter (session révoquée en base) : 204
curl -s -b /tmp/miam-cookies.txt -X POST "$API/auth/logout" -o /dev/null -w '%{http_code}\n'

# Renvoyer le lien de vérification (un par minute au plus)
curl -s -X POST "$API/auth/verify-email/resend" -H "Authorization: Bearer $TOKEN" -w '%{http_code}\n'

# Mot de passe oublié : toujours 204 ; l'email (s'il y a un compte) arrive dans Mailpit
jq -n --arg e "$EMAIL" '{email:$e}' | curl -s "$API/auth/forgot-password" -H 'Content-Type: application/json' -d @- -w '%{http_code}\n'

# Journal de sécurité de l'authentification (en production : prod logs api, voir docs/COMMANDES.md)
docker compose logs backend | grep -E 'auth\.(login|refresh|logout|password|email|register)'
```

## Tests

- e2e : `auth-register`, `auth-login`, `auth-refresh` (rotation, rejeu d'un jeton révoqué, expiration, déconnexion d'un seul appareil), `auth-guard` (token expiré, falsifié, `alg: none`), `auth-change-password`, `email-verification`, `password-reset` (pas d'énumération, limite d'un email par minute même en parallèle, usage unique, expiration).
- Le faux `Mailer` des tests capture les emails pour en extraire le lien.

## À savoir

- Le cookie a `Path=/auth` : il n'est envoyé qu'aux routes d'authentification. C'est pour cela que `change-password` est sous `/auth` (il doit poser le nouveau cookie).
- `Secure` est toléré par les navigateurs sur `http://localhost` : le dev fonctionne sans HTTPS.
- L'application mobile prévue devra avoir un mode « client mobile », avec le refresh token dans le stockage sécurisé du téléphone au lieu d'un cookie (voir CLAUDE.md).
