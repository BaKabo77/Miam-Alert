# Front (application web)

Application React 19 en TypeScript, construite avec Vite, stylée avec Tailwind CSS 4. C'est une **PWA** : installable sur le téléphone, elle s'ouvre comme une application. Elle ne contient **aucune règle de sécurité qui compte** : tout est revérifié par l'API. Ses protections à elle (redirection vers la connexion, contrôles de formulaire) servent au confort de l'utilisateur.

Vue d'ensemble du projet : [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Organisation

```
src/
├── main.tsx            # point d'entrée : TanStack Query, routeur, session
├── App.tsx             # la liste des pages (routes)
├── index.css           # thème (couleurs, police) et classes réutilisables
├── lib/api.ts          # client HTTP unique : token, renouvellement de session, erreurs
├── auth/session.tsx    # session : état, connexion, déconnexion, garde des pages privées
├── pages/              # une page par route
├── components/         # cadres de page (AppLayout, AuthLayout), logo, icônes
├── pantry/             # inventaire : appels API, carte d'un article, dates, styles d'urgence partagés
├── products/           # scanner de code-barres, appel API produit
├── alerts/             # bandeau de l'alerte du jour
├── households/         # foyer partagé : appels API
├── recipes/            # idées de recettes : appels API, carte de suggestion, idée sur l'inventaire
├── profile/            # sections de la page profil
├── assets/landing/     # captures de la page de présentation (WebP)
└── legal/              # cadre et informations des pages légales
```

Chaque domaine a un fichier `*-api.ts` qui fait les appels et déclare les types renvoyés par l'API (copies des types du backend, à tenir alignés).

## Les pages

| Route | Page | Accès |
|---|---|---|
| `/login`, `/register` | Connexion, inscription | Publiques (redirigent vers `/` si l'on est déjà connecté) |
| `/forgot-password` | Demande d'un lien de réinitialisation | Publique |
| `/reset-password#token=…` | Choix du nouveau mot de passe (lien de l'email) | Publique |
| `/verify-email#token=…` | Confirmation de l'adresse (lien de l'email) | Publique : le lien peut être ouvert sur un autre appareil |
| `/legal`, `/privacy`, `/terms` | Mentions légales, politique de confidentialité, conditions générales d'utilisation | Publiques (obligation légale ; les CGU se lisent avant l'inscription) |
| `/` | Connecté : inventaire (compteurs, bandeaux de l'email à confirmer, de l'alerte du jour et d'une idée de recette si un produit est urgent, liste par urgence, bouton « Ajouter »). Sans session : **page de présentation** ([`LandingPage`](src/pages/LandingPage.tsx)) | Publique pour la présentation, connecté pour l'inventaire |
| `/recipes` | Idées recettes : les 8 meilleures, puis les autres sur demande ; produits utilisés aux couleurs de l'urgence, ingrédients à acheter | Connecté |
| `/recipes/:recipeId` | Fiche recette : ingrédients (✓ = dans l'inventaire), étapes, « J'ai cuisiné ça » (les produits cochés passent en « consommé ») | Connecté |
| `/scan` | Scanner, ou saisie du code-barres au clavier | Connecté ; chargée à la demande (la bibliothèque de lecture est lourde) |
| `/add` | Formulaire d'ajout, pré-rempli après un scan | Connecté |
| `/profile` | Prénom et nom, déconnexion, mot de passe, export, suppression du compte | Connecté |
| `/household` | Onglet Foyer : nom, membres et leur rôle, liens d'invitation, retrait d'un membre, transfert de la propriété, départ | Connecté ; actions selon le rôle, vérifiées par l'API |
| `/join#token=…` | Lien d'invitation : aperçu du foyer, puis confirmation | Connecté (sans session, la connexion ou l'inscription ramène ici) |

Les pages connectées sont enveloppées par `<RequireAuth>` (redirection vers `/login`) et partagent `<AppLayout>` : barre du haut avec l'avatar, barre d'onglets en bas (**Inventaire, Scanner mis en avant, Recettes, Foyer**). La saisie manuelle (`/add`) s'ouvre depuis l'inventaire et la page de scan. Changer de page joue une courte animation ([`PageTransition`](src/components/PageTransition.tsx), 220 ms) : la page arrive du côté de l'onglet choisi, dans l'ordre des onglets du bas (une page de détail se place juste après son onglet). Elle est désactivée quand l'appareil demande moins d'animations (`motion-safe`) ; les animations sont déclarées dans `index.css`. Toute URL inconnue renvoie vers `/`.

### CGU et contact

- L'inscription exige de cocher « J'accepte les conditions générales d'utilisation » ; la version acceptée (`legal/terms.ts`, identique à celle du backend) part avec le formulaire.
- Quand les CGU changent, `/me` renvoie `termsAccepted: false` et `<RequireAuth>` affiche [`TermsGate`](src/auth/TermsGate.tsx) à la place de l'application : accepter, se déconnecter ou supprimer son compte (refuser ne doit pas obliger à accepter pour partir).
- L'adresse de contact publique est `support@miam-alert.fr` (`legal/publisher.ts`) : lien « Contact » en bas des pages, section « Aide et contact » du profil, CGU et pages légales.

### Mesure d'audience

[`lib/analytics.ts`](src/lib/analytics.ts) charge le script d'Umami (auto-hébergé, sans cookie) **seulement** si `VITE_STATS_URL` et `VITE_STATS_WEBSITE_ID` sont fournis à la construction ; sinon, rien. Options : « Ne pas me pister » respecté, ni paramètres d'URL ni fragment envoyés.
- Événements : `trackEvent('signup' | 'product-scanned' | 'item-added' | 'recipe-viewed' | 'recipe-cooked')`, une liste fermée **sans donnée associée** (aucune donnée personnelle possible). Ajouter un événement : l'ajouter au type `AnalyticsEvent`, puis à la politique de confidentialité.
- Opposition par appareil : [`legal/AnalyticsChoice.tsx`](src/legal/AnalyticsChoice.tsx), dans la politique de confidentialité.
- La CSP n'autorise que l'adresse d'Umami (`__STATS_URL__` dans `nginx/security-headers.conf.template`).

Détails, choix et mise en service : [deploy/analytics/README.md](../deploy/analytics/README.md).

## Session et appels à l'API

### Le client HTTP ([`lib/api.ts`](src/lib/api.ts))

**Tous** les appels passent par `apiRequest()`. Il :
- ajoute `Authorization: Bearer <access token>` et envoie les cookies (`credentials: 'include'`) ;
- sur un **401**, renouvelle la session (`POST /auth/refresh`) **une fois**, puis rejoue la requête ; si le renouvellement échoue, la session est terminée ;
- lève une `ApiError` qui porte le code HTTP : les pages en tirent un message adapté.

Règles de sécurité :
- **L'access token vit uniquement en mémoire** (une variable du module), jamais dans `localStorage` ou `sessionStorage`, que n'importe quel script de la page pourrait lire en cas de faille XSS. Il est perdu au rechargement : la session est alors restaurée grâce au cookie.
- Le **refresh token** est dans un cookie `httpOnly` : le code JavaScript ne le voit jamais.
- **Un seul renouvellement à la fois** (`refreshInFlight`). Si deux requêtes reçoivent un 401 en même temps, elles attendent le même renouvellement. Deux renouvellements simultanés présenteraient le même jeton, et l'API y verrait un vol : elle couperait la session.
- Les routes `/auth/*` passent `retryOnUnauthorized: false` : un 401 au login veut dire « mauvais identifiants », pas « token expiré ».

### La session ([`auth/session.tsx`](src/auth/session.tsx))

`AuthProvider` tient l'état de la session : `loading`, `anonymous` ou `authenticated` (avec l'utilisateur renvoyé par `GET /me`).
- Au chargement de la page, il tente un renouvellement : si le cookie est encore valide, l'utilisateur est reconnecté sans rien saisir.
- Il expose `login`, `register` (qui connecte ensuite), `logout`, `updateProfile`, `changePassword`, `deleteAccount` et `reloadUser`, via `useAuth()`.
- **Fin de session** : le token est oublié **et le cache de TanStack Query est vidé**. Sinon, l'inventaire du compte précédent resterait en mémoire pour la personne qui se connecte ensuite.
- **Plusieurs foyers** : `useCurrentHousehold()` et `useHouseholdId()` donnent le foyer affiché, choisi dans le sélecteur de l'en-tête (`selectHousehold`, visible à partir de deux foyers). S'il ne fait plus partie des foyers du compte (quitté, ou retiré par le propriétaire), c'est le premier. Le choix est retenu dans le stockage local (`miam.household`, un simple identifiant, effacé à la déconnexion). Les requêtes étant rangées par foyer dans le cache, changer de foyer change toutes les données affichées.
- **Retour après la connexion** : `<RequireAuth>` garde la page demandée dans l'état de l'historique (`state.from`), et `returnPath()` y ramène après la connexion ou l'inscription. Seul un chemin interne est accepté. C'est ce qui permet à un invité sans session de ne pas perdre son lien.

### Page de présentation

- Affichée par `<RequireAuth>` à un visiteur sans session sur `/`, à la place du renvoi vers `/login` (les autres pages protégées y renvoient toujours). Statique : aucun appel à l'API, aucune donnée personnelle.
- **Chaque phrase doit rester vraie** : elle décrit l'application telle qu'elle est (fonctionnalités, confidentialité). Une fonctionnalité ou une règle de confidentialité qui change impose de relire cette page, comme la politique de confidentialité.
- Les captures (`src/assets/landing/`) viennent d'un compte de démonstration créé en dev (prénoms et produits fictifs, supprimé ensuite), photographié dans Chromium à 390 px de large et en triple résolution, puis converties en WebP de 780 px de large (`cwebp -resize 780 0 -q 80`). La date du premier produit de l'inventaire y est figée : refaire les captures quand l'interface change.

### Foyer partagé

- Le **jeton d'invitation** est lu une fois dans le fragment de l'URL ([`JoinPage`](src/pages/JoinPage.tsx)), puis retiré de la barre d'adresse et de l'historique : il ne reste qu'en mémoire, et part dans le corps d'un POST.
- Le **lien créé** n'existe qu'en mémoire dans [`HouseholdPage`](src/pages/HouseholdPage.tsx) : l'API ne le renvoie qu'une fois.
- L'interface masque les actions réservées au propriétaire et explique pourquoi on ne peut pas quitter un foyer, mais **c'est l'API qui décide** (voir [households/](../backend/src/households/README.md)).

### Les données (TanStack Query)

- **Lire** : `useQuery` avec une clé, par exemple `['pantry-items', householdId]`, `['today-alert', householdId]` ou `['recipe-suggestions', householdId]`. TanStack Query gère le chargement, les erreurs et le cache. Les suggestions sont toujours demandées au maximum (20) : la page Recettes, l'idée de l'inventaire et la fiche partagent le même cache.
- Toute modification de l'inventaire invalide **aussi** `['recipe-suggestions']` : une idée de recette ne doit jamais reposer sur un inventaire périmé.
- **Modifier** : `useMutation`, puis `invalidateQueries` sur la clé concernée : la liste est rechargée toute seule. Le bandeau d'alerte fait une mise à jour optimiste : il disparaît tout de suite, et réapparaît si l'API refuse.

## Le scan

1. [`BarcodeScanner`](src/products/BarcodeScanner.tsx) ouvre la caméra arrière avec `@zxing/browser` et ne cherche que les **EAN-13 et EAN-8** (moins de fausses lectures). Il demande une haute résolution et analyse une image toutes les 100 ms. **La caméra est éteinte** quand le composant disparaît.
2. Le code lu est envoyé à `GET /products/:barcode`. En cas d'échec, la page propose un message adapté (produit inconnu, code invalide, trop de recherches, service indisponible), un nouveau scan ou la saisie manuelle. La saisie du code au clavier reste toujours possible.
3. Produit trouvé : la page `/add` s'ouvre, pré-remplie avec la fiche, la photo et la **date suggérée**. La fiche est transmise par l'état de navigation (`navigate('/add', { state })`), pas par l'URL.
4. L'utilisateur vérifie la date (raccourcis +3 j, +1 sem, +1 mois) et le type DLC ou DDM, puis enregistre.

Les dates sont calculées dans le fuseau de l'utilisateur ([`pantry/dates.ts`](src/pantry/dates.ts)) : « demain » doit être demain pour lui. Elles sont affichées en UTC, puisqu'elles sont stockées à minuit UTC.

## Apparence

Le style est « page blanche, composants colorés » : typographie noire et sobre, couleur réservée aux boutons, compteurs, badges et bandeaux.
- Tout le thème est dans [`index.css`](src/index.css) : police **Schibsted Grotesk**, auto-hébergée (aucune requête vers Google Fonts, donc aucune IP transmise) ; couleurs (`ink`, `brand` orange, et des paires pastel/foncé : `peach`, `tomato`, `sun`, `mint`, `ice`) ; classes réutilisables (`btn-primary`, `btn-secondary`, `input`, `label`, `card`, `chip`, `alert-error`…).
- Les contrastes respectent le niveau **WCAG AA**. L'orange est toujours accompagné de texte **noir** : du blanc dessus serait illisible pour une partie des gens.
- Accessibilité : `role="alert"` et `role="status"` sur les messages, libellés explicites sur les boutons d'icônes, navigation au clavier visible.

Changer une couleur dans `index.css` la change dans toute l'application.

## PWA

Configurée dans [`vite.config.ts`](vite.config.ts) (`vite-plugin-pwa`) : manifeste, icônes, mise à jour automatique. Le service worker ne met en cache **que les fichiers de l'application**, **jamais les réponses de l'API** : l'inventaire et le profil ne doivent pas rester lisibles dans le navigateur après la déconnexion, par exemple sur un appareil partagé. Hors ligne, l'application s'ouvre, mais la connexion exige le réseau.

## Production

[`Dockerfile`](Dockerfile), en deux étapes :
1. **Compilation** avec Node. `VITE_API_URL`, l'adresse publique de l'API, est inscrite dans le code **et** dans la CSP de Nginx. Elle est validée par une expression régulière : une valeur malformée pourrait injecter des directives dans la configuration Nginx.
2. **Image finale** `nginx-unprivileged` : Nginx sans Node, sans npm, sans code source, sous un utilisateur non privilégié (uid 101), avec des fichiers en lecture seule.

[`nginx/`](nginx) :
- `default.conf.template` : sert les fichiers, accepte seulement `GET` et `HEAD`, met en cache un an les fichiers à empreinte (`/assets/`), **jamais** le service worker ni le manifeste (une nouvelle version, correctif de sécurité compris, ne doit pas rester bloquée), et renvoie `index.html` pour toute autre URL (application monopage) ;
- `security-headers.conf.template` : **CSP stricte** (scripts et styles de l'application seulement ; images de l'application et d'Open Food Facts ; requêtes vers l'API seulement ; aucun cadre), `nosniff`, `Referrer-Policy: no-referrer`, caméra autorisée pour l'application seule. Ce fichier est inclus dans **chaque** bloc `location`, parce qu'un `add_header` dans un `location` annule ceux hérités du bloc `server`.

Le HTTPS et le HSTS sont gérés par Caddy, devant (voir [deploy/caddy/](../deploy/caddy/README.md)).

## Commandes

Liste complète : [docs/COMMANDES.md](../docs/COMMANDES.md).

```bash
docker compose up -d frontend                      # serveur de dev Vite sur http://localhost:5173
docker compose logs -f frontend                    # journaux de Vite
docker compose exec frontend npm run lint          # oxlint
docker compose exec frontend npm run build         # compilation TypeScript + build de production
docker compose exec frontend npm audit --audit-level=high
docker compose exec frontend npm install <paquet>  # ajouter une dépendance
```

Essayer l'image de **production** en local (Nginx, CSP, cache), sur http://localhost:8081 :

```bash
docker build --build-arg VITE_API_URL=http://localhost:3000 -t miam-test/web frontend
docker run --rm -d --name miam-test-web -p 127.0.0.1:8081:8080 miam-test/web
curl -sI http://localhost:8081/ | grep -iE 'content-security-policy|x-frame|cache-control'
docker rm -f miam-test-web
```

Le serveur de dev est sur le port **5173 fixe** : c'est l'origine autorisée par le CORS de l'API.

## Ajouter une page

1. Créer `src/pages/XxxPage.tsx`.
2. La déclarer dans [`App.tsx`](src/App.tsx) : sous `<RequireAuth>` si elle exige d'être connecté, à la racine sinon, avec un commentaire qui justifie pourquoi elle est publique.
3. Appels à l'API : une fonction dans le `*-api.ts` du domaine, jamais de `fetch` direct ; lecture avec `useQuery`, écriture avec `useMutation` et invalidation de la clé.
4. Messages d'erreur selon `ApiError.status`, sans détail technique. Pour l'authentification, ne jamais révéler si un compte existe.
5. Une ressource externe (image, script, API) doit être autorisée dans la CSP (`nginx/security-headers.conf.template`), et justifiée.
6. Une nouvelle donnée personnelle collectée : mettre à jour la politique de confidentialité ([`PrivacyPage.tsx`](src/pages/PrivacyPage.tsx)) et `LEGAL_LAST_UPDATED` ([`legal/publisher.ts`](src/legal/publisher.ts)).

## Limites connues

- L'inventaire n'affiche que les **100 premiers articles** (une seule page demandée à l'API).
- Pas encore de tests automatisés du front (prévus pour la v1.0 : client HTTP, session, parcours Playwright en CI).
- Les types des réponses de l'API sont recopiés à la main : un changement côté backend doit être reporté ici.

## Pièges

- **L'apostrophe du dossier `Miam'Alert`** fait échouer `npm run build` sur l'hôte (Workbox). Construire dans le conteneur.
- En développement, React exécute les effets **deux fois** (`StrictMode`). Une action à usage unique, comme la vérification d'un lien d'email, doit être protégée par un `useRef` (voir [`VerifyEmailPage.tsx`](src/pages/VerifyEmailPage.tsx)).
- Les jetons des liens d'email sont dans le **fragment** (`#token=`) : les pages les lisent puis les retirent aussitôt de la barre d'adresse et de l'historique.
- Les informations de l'éditeur (nom, contact, hébergeur) sont dans [`legal/publisher.ts`](src/legal/publisher.ts) : un seul endroit à modifier.
