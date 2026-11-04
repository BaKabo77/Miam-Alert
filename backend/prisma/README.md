# Base de données (Prisma)

Le modèle de données est décrit dans [`schema.prisma`](schema.prisma) ; chaque modification passe par une **migration** SQL versionnée dans [`migrations/`](migrations). L'application n'accède à la base que par `PrismaService` ([`src/prisma/`](../src/prisma/prisma.service.ts)).

## Le modèle

```
User ──< HouseholdMember >── Household ──< PantryItem >── Product (cache Open Food Facts)
                                              │
                                              └──▶ Ingredient ──< RecipeIngredient >── Recipe
 │                               │
 ├──< RefreshToken (sessions)    ├──< Alert (une par foyer et par jour)
 └──< EmailToken (liens envoyés  └──< HouseholdInvitation (liens d'invitation)
       par email)
```

| Table | Contenu | Points importants |
|---|---|---|
| `User` | Compte : email (unique, en minuscules), hash argon2 du mot de passe, prénom et nom facultatifs, date de vérification de l'email | `passwordHash` est exclu de **toutes** les requêtes par défaut (voir plus bas) |
| `Household` | Foyer : un nom | Propriétaire de l'inventaire et des alertes |
| `HouseholdMember` | Lien utilisateur ↔ foyer, avec un rôle (`OWNER`, `MEMBER`) | Clé primaire composée : on ne peut pas être deux fois membre du même foyer. C'est la table interrogée pour tout contrôle d'accès |
| `Product` | Fiche produit issue d'Open Food Facts : code-barres (unique), nom, marque, image, catégories, Nutri-Score | Partagée par tous les foyers (donnée publique) |
| `PantryItem` | Article de l'inventaire : nom, quantité et unité, date et type (DLC/DDM), statut, ingrédient reconnu | `householdId` obligatoire ; `productId` facultatif (saisie manuelle) ; `ingredientKey` calculé par le serveur ; index `(householdId, status, expiryDate)` taillé pour l'inventaire trié |
| `RefreshToken` | Une ligne par refresh token émis : empreinte SHA-256, famille (= connexion), expiration, révocation | Jamais le jeton lui-même |
| `EmailToken` | Lien de vérification ou de réinitialisation : empreinte SHA-256, usage, expiration, date d'utilisation | Usage unique |
| `HouseholdInvitation` | Lien d'invitation dans un foyer : empreinte SHA-256, auteur, expiration, date d'utilisation et qui l'a utilisé | Usage unique ; auteur et utilisateur en `SetNull` (la suppression d'un compte ne garde aucun lien vers lui) |
| `Alert` | Alerte du jour d'un foyer : deux compteurs, date de lecture | `@@unique([householdId, date])` : impossible d'en créer deux le même jour |
| `Ingredient` | Ingrédient du catalogue (clé stable « egg », nom, basique ou non) | Catalogue public défini dans le code, recopié au démarrage (voir [recipes/](../src/recipes/README.md)) |
| `Recipe`, `RecipeIngredient` | Recettes locales et leurs ingrédients (quantité, facultatif, ordre) | Idem ; `slug` stable, identifiant UUID |
| `CatalogVersion` | Empreinte du catalogue déjà recopié | Évite toute écriture au démarrage si rien n'a changé |

### Conventions du schéma

- **Identifiants en UUID** (`@db.Uuid`) : impossibles à deviner, contrairement à 1, 2, 3…
- **Enums** plutôt que du texte libre (`ExpiryType`, `PantryItemStatus`, `QuantityUnit`, `HouseholdRole`, `EmailTokenPurpose`) : la base refuse elle-même une valeur inconnue.
- **Longueurs bornées** (`@db.VarChar(n)`), alignées sur les DTO.
- **Dates sans heure** (`@db.Date`) pour la péremption et le jour d'une alerte, stockées à minuit UTC : « périme le 20 » ne dépend d'aucun fuseau horaire.
- **Quantités entières** dans l'unité la plus petite (1,5 L = 1 500 mL) : pas d'erreur d'arrondi.

### Suppressions en cascade

Elles sont pensées pour le droit à l'effacement (RGPD) :

| On supprime… | …ce qui part avec |
|---|---|
| un `User` | ses appartenances, sessions et liens d'email ; ses invitations restent, sans lien vers lui (`SetNull`) |
| un `Household` | ses appartenances, articles, alertes et invitations |
| un `Product` | rien : les articles liés gardent leur nom (`SetNull`) |

Supprimer un compte ne supprime **pas** ses foyers par cascade : `UsersService.deleteMe` supprime d'abord ceux dont il est le seul membre, et transmet la propriété des foyers partagés (voir [users/](../src/users/README.md)).

## PrismaService

[`src/prisma/prisma.service.ts`](../src/prisma/prisma.service.ts) :
- se connecte via `@prisma/adapter-pg` avec l'URL de la configuration validée ;
- **exclut `passwordHash` de toutes les requêtes** (`omit` global). Seuls la connexion, le changement de mot de passe et la suppression du compte le redemandent explicitement ;
- ne journalise pas les requêtes (elles contiendraient des emails et des inventaires) ;
- se connecte au démarrage : une base injoignable est signalée tout de suite.

`PrismaModule` est global : `PrismaService` s'injecte partout sans import, avec un seul pool de connexions.

Règles d'usage :
- Toujours un `select` explicite : on ne lit que ce qu'on renvoie.
- `$queryRaw` (avec des backticks, donc paramétré) est autorisé. `$queryRawUnsafe` et `$executeRawUnsafe` sont **interdits**.
- Préférer une contrainte de la base (unicité, condition dans un `updateMany`) à un « lire puis écrire », qui laisse passer deux requêtes simultanées.

## Modifier le schéma

1. Modifier `schema.prisma`, avec un commentaire qui explique le pourquoi des choix.
2. Créer la migration dans le conteneur :
   ```bash
   docker compose exec backend npx prisma migrate dev --name <nom_explicite>
   docker compose exec backend npx prisma generate
   ```
3. Relire le SQL généré dans `migrations/<date>_<nom>/migration.sql`, surtout s'il y a des suppressions de colonnes ou des contraintes sur des données existantes.
4. Mettre à jour le DTO, le `select`, le type de réponse, l'export RGPD (`EXPORT_SELECT` dans [users/](../src/users/README.md)) et `test/setup/reset-database.ts` si une table apparaît.
5. Commiter le schéma **et** la migration ensemble.

En production, les migrations sont appliquées par le conteneur `migrate` **avant** le démarrage de l'API (`prisma migrate deploy`) : si elles échouent, l'API ne démarre pas sur un schéma qui ne lui correspond pas. Elles tournent avec le rôle `miam_owner`, propriétaire des tables mais sans droit d'administration ; l'API, elle, n'a que les droits sur les lignes (`miam_app`). Une migration ne peut donc pas exiger un superutilisateur (`CREATE EXTENSION`, par exemple) : voir [deploy/database/](../../deploy/database/README.md).

## Commandes

Toutes dans le conteneur, pour que l'hôte `db` soit résolu.

```bash
docker compose exec backend npx prisma migrate dev --name <nom>   # nouvelle migration (après modification du schéma)
docker compose exec backend npx prisma generate                  # régénérer le client
docker compose exec backend npx prisma migrate status            # migrations appliquées ou en attente
docker compose exec backend npx prisma validate                  # vérifier le schéma
docker compose exec backend npx prisma format                    # mettre en forme schema.prisma

# Console SQL de la base de dev
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Interface web : Adminer, http://localhost:8080 (système PostgreSQL, serveur db)
```

⚠️ `docker compose exec backend npx prisma migrate reset` **efface la base de dev** puis réapplique toutes les migrations.

**(serveur)** Console SQL de production, en lecture et avec prudence (`prod` : voir [docs/COMMANDES.md](../../docs/COMMANDES.md#production)) :

```bash
prod exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

`prisma studio` n'est pas utilisable : son port n'est pas publié par `docker-compose.yml`.

## Pièges

- Une migration déjà appliquée (en prod ou sur une autre branche) **ne se modifie jamais** : on en crée une nouvelle.
- Deux branches qui créent chacune une migration doivent être empilées ou réordonnées avant la fusion. Sinon, `migrate dev` signale une dérive (*drift*).
- La configuration de Prisma est dans [`../prisma.config.ts`](../prisma.config.ts) (Prisma 7). Il exige `DATABASE_URL` ; pour `prisma generate` seul, une valeur factice suffit (c'est ce que fait le `Dockerfile`).
- Le client est généré dans `src/generated/prisma` (non commité).
- Base de dev : Adminer sur http://localhost:8080 (serveur `db`) ou `docker compose exec db psql -U <utilisateur> <base>`.
