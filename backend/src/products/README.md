# Produits (`products`)

Recherche d'un produit par son code-barres. La fiche (nom, marque, photo, catégories, Nutri-Score) vient d'**Open Food Facts**, une base libre et collaborative, et est **mise en cache** dans la table `Product`. L'API suggère aussi une **date de péremption** selon la catégorie du produit.

## Route

| Route | Accès | Vérification | Réponse |
|---|---|---|---|
| `GET /products/:barcode` | Connecté, **30/min** | Code-barres EAN-8 ou EAN-13 valide (clé de contrôle comprise) | Fiche + `suggestedExpiry` ; 400 code invalide ; 404 produit inconnu ; 503 Open Food Facts indisponible |

Pas de contrôle de foyer : les fiches produits sont publiques et partagées par tous. Le token empêche d'utiliser l'API comme relais anonyme vers Open Food Facts, et la limite de 30 par minute empêche d'en aspirer le catalogue.

## Le parcours d'une recherche

1. **Validation** du code-barres par `ParseEanPipe` ([`ean.ts`](ean.ts)) : 8 ou 13 chiffres, et clé de contrôle correcte. Un code mal scanné ou inventé est refusé sans aucun appel externe.
2. **Cache** : si le code est déjà en base, la fiche est renvoyée directement.
3. Sinon, **appel à Open Food Facts** ([`open-food-facts.client.ts`](open-food-facts.client.ts)) :
   - URL construite avec l'API `URL` (pas de concaténation brute), en ne demandant que les champs utiles ;
   - délai de 5 secondes, aucune redirection suivie, `User-Agent` identifiant l'application (demandé par Open Food Facts) ;
   - produit inconnu (404 ou `status: 0`) : `null` ; panne, lenteur ou réponse illisible : `OpenFoodFactsUnavailableError`.
4. **Nettoyage** ([`open-food-facts.mapper.ts`](open-food-facts.mapper.ts)) : les données d'Open Food Facts sont **non fiables** (saisies par des contributeurs, transmises par le réseau) :
   - textes sans caractères de contrôle, espaces normalisés, longueurs bornées ;
   - nom en français de préférence ; **sans nom, la fiche est considérée comme inconnue** ;
   - première marque seulement ;
   - image acceptée **uniquement en HTTPS sur `*.openfoodfacts.org`** (sinon le navigateur chargerait une ressource d'un domaine quelconque) ;
   - catégories au format `en:xxx`, sans doublon, 30 au plus ;
   - Nutri-Score de A à E, sinon `null`.
5. **Enregistrement** par `upsert` : si deux personnes scannent le même produit au même instant, l'unicité du code-barres ne provoque pas d'erreur.
6. **Réponse** : la liste complète des catégories reste interne ; seule la suggestion de date qui en découle est renvoyée.

Si Open Food Facts est en panne, l'API répond 503 sans détail, et le front propose la saisie manuelle : **l'application reste utilisable**.

## La date suggérée

[`shelf-life.ts`](shelf-life.ts) associe des catégories Open Food Facts à une durée habituelle de conservation d'un produit **non entamé**, avec le type de date (par exemple, poisson : 2 jours en DLC ; pâtes : 365 jours en DDM).

- L'**ordre des règles compte** : la première qui correspond l'emporte. Les catégories les plus précises et les plus périssables passent en premier, parce qu'un jambon est **aussi** une viande dans la classification d'Open Food Facts, et un plat surgelé **aussi** un plat préparé. Conserves et surgelés sont en tête : le mode de conservation l'emporte sur la nature de l'aliment.
- La table est **côté serveur** : le client ne choisit jamais la durée, il l'affiche seulement.
- Ce n'est qu'une suggestion : le formulaire invite toujours à vérifier la date imprimée.

Ajouter une règle : l'insérer au bon endroit dans `RULES`, puis ajouter un cas dans `shelf-life.spec.ts`, surtout si la catégorie en recouvre une autre.

## Fichiers

| Fichier | Rôle |
|---|---|
| `products.controller.ts` | La route et sa limite de débit |
| `products.service.ts` | Cache, appel externe, enregistrement, traduction des erreurs (404, 503) |
| `open-food-facts.client.ts` | L'appel HTTP à Open Food Facts |
| `open-food-facts.mapper.ts` | Validation et nettoyage de la réponse |
| `ean.ts` | Validation EAN (format et clé de contrôle), pipe de paramètre |
| `shelf-life.ts` | Durées de conservation par catégorie |
| `products.types.ts` | `ProductData` (donnée nettoyée) et `ProductResponse` (ce qui sort) |

## Commandes

Variables `API`, `TOKEN` et `HOUSEHOLD` : voir [Appeler l'API en dev](../../../docs/COMMANDES.md#appeler-lapi-en-dev).

```bash
# Tests du module
docker compose exec backend npm test -- src/products
docker compose exec backend npm run test:e2e -- products pantry-product

# Chercher un produit : appelle Open Food Facts la première fois, puis sert le cache
curl -s "$API/products/3017620422003" -H "Authorization: Bearer $TOKEN" | jq

# Code-barres invalide (mauvaise clé de contrôle) : 400, sans appel externe
curl -s -o /dev/null -w '%{http_code}\n' "$API/products/3017620422004" -H "Authorization: Bearer $TOKEN"

# Contenu du cache
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT barcode, name, category FROM \"Product\" ORDER BY \"createdAt\" DESC LIMIT 10"'

# Open Food Facts indisponible ou lent
docker compose logs backend | grep 'Open Food Facts unavailable'
```

## Tests

- Unitaires : `ean.spec.ts`, `open-food-facts.mapper.spec.ts` (types inattendus, caractères de contrôle, image en HTTP, d'un autre domaine, d'un domaine imitant celui d'Open Food Facts ou en `javascript:`), `open-food-facts.client.spec.ts` (réseau simulé : URL appelée, délai, produit inconnu, erreur serveur, réponse qui n'est pas du JSON), `shelf-life.spec.ts`.
- e2e : `products` (cache, codes invalides, produit inconnu non mis en cache, 503 sans détail). Le client Open Food Facts est remplacé par un faux : **aucun test n'appelle le vrai service**.

## À savoir

- Les fiches en cache ne sont jamais rafraîchies : une fiche corrigée sur Open Food Facts n'est pas mise à jour chez nous (amélioration possible).
- Les photos sont chargées par le navigateur directement depuis Open Food Facts, qui reçoit donc l'adresse IP de l'utilisateur. C'est indiqué dans la politique de confidentialité, et la CSP du front n'autorise que ce domaine pour les images.
