# Recettes (`recipes`)

Suggestions de recettes qui utilisent **en priorité les produits qui périment le plus vite**. C'est la fonctionnalité anti-gaspi centrale de l'application. La v0.7 s'appuie sur une base de recettes **locale et gratuite** ; les recettes par IA (offre Premium) viendront se brancher derrière la même interface.

## Routes

| Route | Accès | Vérification | Réponse |
|---|---|---|---|
| `GET /households/:householdId/recipes/suggestions?limit=` | Connecté, **membre du foyer** | `assertMember` (404 pour le foyer d'un autre) ; `limit` de 1 à 20, 10 par défaut | `{ suggestions: [...] }` : recette résumée, articles utilisés, ingrédients manquants |
| `GET /recipes/:recipeId` | Connecté | Identifiant UUID ; catalogue public, sans donnée de foyer | Recette complète : ingrédients dans l'ordre, étapes |

## Comment ça marche

```
Article ajouté ──▶ ingrédient reconnu par le serveur (ingredientKey)
                    · fiche produit : catégorie Open Food Facts la plus précise
                    · sinon nom : mot-clé le plus long (« pommes de terre » avant « pommes »)

Suggestions ──▶ articles ACTIFS et reconnus du foyer, avec leur urgence
            ──▶ RecipeProvider (LocalRecipeProvider) ──▶ scoreRecipes() ──▶ classement
```

### Le classement
[`suggestions.ts`](suggestions.ts) est une fonction pure, testée unitairement. Pour chaque ingrédient, elle retient l'article **le plus urgent**, puis classe les recettes par ordre de priorité :
1. le nombre de produits **urgents** sauvés (à consommer sous 2 jours, ou DDM dépassée) ;
2. puis le nombre de produits de **la semaine** ;
3. puis la part des ingrédients nécessaires **déjà à la maison** ;
4. puis le **moins de courses**.

Ce n'est pas une somme de points : avec des poids additionnés, plusieurs produits qui peuvent attendre finissent toujours par l'emporter sur un produit à manger aujourd'hui. Un test le vérifie.

Règles :
- ⚠️ **Un produit à DLC dépassée n'est jamais proposé** : risque sanitaire. Une DDM dépassée reste consommable et compte comme urgente.
- Les **basiques** (sel, huile, farine, oignon…) et les ingrédients **facultatifs** ne sont jamais « manquants ». S'ils sont présents et urgents, ils comptent quand même.
- Une recette qui n'utilise aucun ingrédient « réel » de l'inventaire n'est pas proposée.

### La reconnaissance des ingrédients
[`ingredient-matcher.ts`](ingredient-matcher.ts) donne à chaque article un ingrédient du catalogue (`PantryItem.ingredientKey`).
- C'est **toujours le serveur** qui le calcule : à la création, et quand le nom change. Un `ingredientKey` envoyé par le client est refusé (400).
- La recherche par nom ignore la casse, les accents et les ligatures (« Œufs » donne `oeufs`), et ne reconnaît que des **mots entiers** (« vaisselle » ne contient pas « sel »).
- Un article non reconnu reste dans l'inventaire ; il ne sert simplement pas aux recettes.

### Le catalogue
Ingrédients et recettes sont une **donnée de référence écrite dans le code** ([`catalog/`](catalog)), relue en revue comme le reste :
- [`ingredients.ts`](catalog/ingredients.ts) : environ 70 ingrédients, avec leurs catégories Open Food Facts et leurs mots-clés, dont une quinzaine de basiques ;
- [`recipes.ts`](catalog/recipes.ts) : une quarantaine de recettes françaises du quotidien, **rédigées pour le projet** (aucun droit d'un tiers : la plupart des sites et jeux de données interdisent la réutilisation commerciale). Elles sont choisies pour utiliser ce qui périme vite.

Au démarrage de l'API, [`RecipeCatalogSync`](recipe-catalog.sync.ts) recopie le catalogue en base :
- **rien n'est fait** si le catalogue n'a pas changé : son empreinte SHA-256 est gardée dans `CatalogVersion` ;
- sinon, tout est mis à jour dans **une seule transaction** : ingrédients, recettes, ingrédients des recettes, suppression de ce qui a disparu ;
- tous les articles des inventaires sont ensuite **reconnus de nouveau**, pour profiter d'un mot-clé ajouté.

[`catalog.spec.ts`](catalog/catalog.spec.ts) vérifie l'ensemble dès la CI : clés et slugs uniques, longueurs compatibles avec la base, ingrédients connus, mots-clés sans doublon et déjà normalisés, catégories Open Food Facts reliées à un seul ingrédient.

### L'interface `RecipeProvider`
[`recipe-provider.ts`](recipe-provider.ts) est le seul contrat dont dépend le service. Le choix de l'implémentation se fait à un seul endroit, [`recipes.module.ts`](recipes.module.ts).

Le futur `AiRecipeProvider` (Premium, Mistral) devra :
- vérifier les **quotas** de l'utilisateur **avant** tout appel au modèle ;
- traiter les noms d'articles comme de simples **données**, contre l'injection de prompt ;
- **valider la réponse du modèle par un schéma** ;
- garder la clé d'API côté serveur uniquement.

## Fichiers

| Fichier | Rôle |
|---|---|
| `recipes.controller.ts` | Les deux routes |
| `recipes.service.ts` | Contrôle d'appartenance, articles du foyer avec leur urgence, recette complète |
| `recipe-provider.ts` | Contrat d'une source de suggestions |
| `local-recipe.provider.ts` | Implémentation locale : charge les recettes, appelle le classement |
| `suggestions.ts` | Classement des recettes (fonction pure) |
| `ingredient-matcher.ts` | Reconnaissance de l'ingrédient d'un article (fonction pure) |
| `recipe-catalog.sync.ts` | Copie du catalogue en base au démarrage |
| `catalog/ingredients.ts`, `catalog/recipes.ts` | Le catalogue |
| `recipes.types.ts` | Ce qui sort de l'API |
| `dto/recipe-suggestions.query.ts` | `limit`, de 1 à 20 |

En base (voir [prisma/README.md](../../prisma/README.md)) : `Ingredient`, `Recipe`, `RecipeIngredient`, `CatalogVersion`, et `PantryItem.ingredientKey`.

## Ajouter ou modifier une recette

1. La décrire dans `catalog/recipes.ts` : un `slug` unique et **stable**, puisqu'il identifie la recette en base, et des ingrédients du catalogue. Ajouter l'ingrédient dans `catalog/ingredients.ts` s'il manque, avec ses mots-clés.
2. Lancer `npm test -- src/recipes` : le test du catalogue signale toute incohérence.
3. Au prochain démarrage de l'API, en dev comme en production, la base est mise à jour toute seule.

Ne jamais renommer un `key` d'ingrédient ou un `slug` de recette : ce serait une suppression suivie d'un ajout. Les articles déjà reconnus perdraient leur ingrédient jusqu'à la synchronisation suivante, et les identifiants des recettes changeraient.

## Commandes

Variables `API`, `TOKEN` et `HOUSEHOLD` : voir [Appeler l'API en dev](../../../docs/COMMANDES.md#appeler-lapi-en-dev).

```bash
# Tests du module
docker compose exec backend npm test -- src/recipes
docker compose exec backend npm run test:e2e -- recipes

# Suggestions pour son foyer : titre, produits sauvés, ce qui manque
curl -s "$API/households/$HOUSEHOLD/recipes/suggestions?limit=5" -H "Authorization: Bearer $TOKEN" \
  | jq -r '.suggestions[] | "\(.recipe.title) | urgents \(.urgentCount) | utilise : \([.uses[].itemName] | join(", ")) | manque : \(.missing | join(", "))"'

# Recette complète (id pris dans une suggestion)
curl -s "$API/recipes/<recipeId>" -H "Authorization: Bearer $TOKEN" | jq

# Synchronisation du catalogue au démarrage
docker compose logs backend | grep RecipeCatalogSync

# Articles non reconnus de la base de dev (pour enrichir les mots-clés)
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d miam_alert -c "SELECT name FROM \"PantryItem\" WHERE \"ingredientKey\" IS NULL"'
```

## Tests

- Unitaires :
  - `suggestions.spec.ts` : ordre de priorité, DLC dépassée jamais proposée, DDM dépassée utilisée, article le plus urgent, basiques et facultatifs ;
  - `ingredient-matcher.spec.ts` : catégories, accents, mot-clé le plus long, mots entiers ;
  - `catalog.spec.ts` : cohérence du catalogue.
- e2e `recipes` :
  - classement et contenu d'une suggestion, DLC dépassée exclue ;
  - articles consommés ignorés, bornes de `limit` ;
  - **foyer d'un autre refusé avec la même réponse qu'un foyer inexistant** ;
  - recette complète, reconnaissance à l'ajout et au renommage, `ingredientKey` du client refusé ;
  - synchronisation idempotente qui répare la base.

## À savoir

- Les catégories Open Food Facts du catalogue sont à **enrichir avec l'usage** : un produit scanné non reconnu par sa catégorie l'est souvent par son nom. La requête « articles non reconnus » ci-dessus aide à trouver les mots-clés manquants.
- À chaque changement du catalogue, la synchronisation relit **tous** les articles de tous les foyers. C'est sans souci à l'échelle actuelle ; au-delà de quelques centaines de milliers d'articles, il faudra la faire par lots, hors du démarrage.
- Pas de filtre végétarien dans l'interface pour l'instant, mais l'information est déjà en base (`vegetarian`).
