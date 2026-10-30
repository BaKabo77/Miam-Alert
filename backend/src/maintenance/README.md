# Entretien de la base (`maintenance`)

Chaque nuit à **4 h (heure de Paris)**, la purge supprime les données devenues inutiles. C'est le principe de **limitation de la conservation** (RGPD) : on ne garde pas indéfiniment ce qui ne sert plus.

## Ce qui est supprimé

Délais définis dans `RETENTION` ([`purge.service.ts`](purge.service.ts)) :

| Donnée | Supprimée… | Pourquoi ce délai |
|---|---|---|
| Sessions (refresh tokens) | **30 jours après leur expiration** | Garder une trace pour enquêter sur un incident (quand une session a été ouverte) |
| Liens envoyés par email | **30 jours après avoir servi ou expiré** | Idem (quand un lien a servi) |
| Alertes du jour | **90 jours après leur date** | Plus aucune utilité après |

Ne sont **jamais** touchés : les comptes, les foyers, les articles de l'inventaire (même anciens) et les fiches produits.

Ces délais sont **annoncés dans la politique de confidentialité** ([`frontend/src/pages/PrivacyPage.tsx`](../../../frontend/src/pages/PrivacyPage.tsx)). Les changer ici impose de mettre à jour ce texte, et sa date (`LEGAL_LAST_UPDATED`).

## Pourquoi pas de suppression immédiate

- Un incident se découvre souvent après coup : les traces récentes permettent de reconstituer ce qui s'est passé.
- Un refresh token **révoqué mais pas encore expiré** doit rester en base. Sinon, sa réutilisation par un voleur ne serait plus reconnue comme telle (voir la rotation dans [auth/](../auth/README.md)). La purge n'attaque que les sessions expirées depuis 30 jours, qui ne peuvent plus servir de toute façon.

## Pourquoi 4 h

La sauvegarde de la base a lieu à 3 h (voir [deploy/backup/](../../../deploy/backup/README.md)). Une donnée supprimée par erreur reste ainsi récupérable dans les sauvegardes des jours précédents.

## Fonctionnement

- Les trois suppressions se font dans **une seule transaction**.
- Le journal ne contient que des nombres (« Purge: 3 session(s), 1 email link(s), 0 alert(s) »).
- Une erreur est journalisée sans arrêter l'application ; la purge du lendemain rattrape.

## Fichiers

| Fichier | Rôle |
|---|---|
| `purge.service.ts` | `RETENTION` et `purgeExpiredData(now)` ; la date est un paramètre, pour que les tests la fixent |
| `purge.scheduler.ts` | Déclenchement chaque nuit à 4 h |
| `maintenance.module.ts` | Déclaration du module |

## Commandes

```bash
# Tests de la purge (chaque délai, juste avant et juste après)
docker compose exec backend npm run test:e2e -- data-purge

# Dernières purges (dev ; serveur : prod logs --since 48h api | grep 'Purge:')
docker compose logs backend | grep 'Purge:'

# Ce que la prochaine purge supprimera (dev)
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  SELECT (SELECT count(*) FROM \"RefreshToken\" WHERE \"expiresAt\" < now() - interval '"'"'30 days'"'"') AS sessions,
         (SELECT count(*) FROM \"EmailToken\" WHERE \"usedAt\" < now() - interval '"'"'30 days'"'"' OR \"expiresAt\" < now() - interval '"'"'30 days'"'"') AS liens,
         (SELECT count(*) FROM \"Alert\" WHERE date < current_date - 90) AS alertes"'
```

La purge n'a pas de commande pour la lancer à la main : elle tourne chaque nuit à 4 h.

## Tests

e2e : `data-purge` (chaque délai, testé juste avant et juste après ; une session révoquée mais encore valable est conservée ; comptes, foyers et inventaire jamais touchés).

## À savoir

La purge n'envoie pas encore de signal de vie à un service de surveillance, contrairement aux alertes de 9 h.
