# Alertes quotidiennes (`alerts`)

Chaque matin à **9 h (heure de Paris)**, l'API crée pour chaque foyer concerné une **alerte du jour** : le nombre de produits périmés et le nombre de produits à consommer vite. Le front l'affiche en bandeau en haut de l'inventaire, jusqu'à ce que l'utilisateur le ferme.

Les notifications push et les emails d'alerte ne sont pas encore faits : l'alerte n'est visible que dans l'application.

## Routes

| Route | Accès | Vérification | Réponse |
|---|---|---|---|
| `GET /households/:householdId/alerts/today` | Connecté | `assertMember` sur le foyer de l'URL | `{ alert: { id, date, expiredCount, urgentCount, read } }` ou `{ alert: null }` |
| `POST /alerts/:alertId/read` | Connecté | Filtre « membre du foyer de l'alerte » dans la requête | 204 ; 404 pour l'alerte d'un autre foyer ou inconnue |

« Pas d'alerte aujourd'hui » est une réponse normale (`alert: null`), pas une erreur. Marquer comme lue est **idempotent** : la première date de lecture est conservée, et l'état est partagé entre les appareils.

## La génération

`AlertsService.generateDailyAlerts()` :
1. charge seulement les articles `ACTIVE` qui périment au plus tard dans 2 jours (inutile de lire tout l'inventaire de tous les foyers) ;
2. les regroupe par foyer : **une alerte par foyer**, pas une par produit ;
3. compte avec **la même fonction d'urgence que l'inventaire** ([`pantry/urgency.ts`](../pantry/urgency.ts)), si bien que l'alerte et les badges de l'application sont toujours d'accord :
   - `expiredCount` : DLC dépassée ;
   - `urgentCount` : 0 à 2 jours restants, ou DDM dépassée ;
4. ne crée rien pour un foyer sans produit urgent (pas d'alerte « tout va bien ») ;
5. insère avec `skipDuplicates` (`ON CONFLICT DO NOTHING`).

**Idempotence** : la contrainte unique `(householdId, date)` en base empêche toute deuxième alerte le même jour, même si la tâche tourne deux fois ou sur deux serveurs en même temps.

L'alerte ne stocke que des **compteurs**, pas la liste des produits : celle-ci est relue dans l'inventaire, qui est toujours à jour. C'est pourquoi le bandeau dit « alerte de **ce matin** ».

## La tâche planifiée

`AlertsScheduler` ([`alerts.scheduler.ts`](alerts.scheduler.ts)) déclenche la génération avec `@Cron('0 9 * * *', { timeZone: 'Europe/Paris' })` : le fuseau gère tout seul l'heure d'été.

- Après la tâche, un **signal de vie** est envoyé à `ALERTS_HEALTHCHECK_URL` (healthchecks.io) : succès, ou `/fail` en cas d'erreur. Si le signal n'arrive pas, le service de surveillance prévient l'administrateur. Une tâche planifiée qui échoue en silence est un piège classique.
- Une erreur est journalisée sans arrêter l'application ; la tâche du lendemain repart normalement.
- Le planificateur est séparé du service pour que les tests appellent directement la génération, sans attendre 9 h.

## Lancer la génération à la main

```bash
docker compose exec backend npm run build
docker compose exec backend npm run alerts:generate
```

[`generate-alerts.cli.ts`](generate-alerts.cli.ts) démarre l'application **sans serveur HTTP** et lance la génération. C'est une commande et non une route : seule une personne ayant accès au serveur peut la déclencher. Elle est sans risque de doublon (idempotente).

## Fichiers

| Fichier | Rôle |
|---|---|
| `alerts.controller.ts` | Les deux routes |
| `alerts.service.ts` | Lecture de l'alerte du jour, marquage comme lue, génération quotidienne |
| `alerts.scheduler.ts` | Déclenchement à 9 h et signal de vie |
| `alert-summary.ts` | Calcul des deux compteurs et décision « alerte nécessaire ou non » (fonctions pures) |
| `alerts.types.ts` | Ce qui sort de l'API (ni `householdId`, ni dates techniques) |
| `generate-alerts.cli.ts` | Génération à la demande, en ligne de commande |

## Commandes

Variables `API`, `TOKEN` et `HOUSEHOLD` : voir [Appeler l'API en dev](../../../docs/COMMANDES.md#appeler-lapi-en-dev).

```bash
# Tests du module
docker compose exec backend npm test -- src/alerts
docker compose exec backend npm run test:e2e -- alerts

# Générer les alertes du jour maintenant (sans doublon si elles existent déjà)
docker compose exec backend npm run build
docker compose exec backend npm run alerts:generate

# Alerte du jour du foyer, puis la marquer comme lue (204)
ALERT=$(curl -s "$API/households/$HOUSEHOLD/alerts/today" -H "Authorization: Bearer $TOKEN" | tee /dev/stderr | jq -r '.alert.id')
curl -s -X POST "$API/alerts/$ALERT/read" -H "Authorization: Bearer $TOKEN" -w '%{http_code}\n'

# (serveur) La tâche de 9 h a-t-elle tourné ? (prod : voir docs/COMMANDES.md)
prod logs --since 24h api | grep -E 'Daily alerts|Heartbeat'
```

## Tests

- Unitaires : `alert-summary.spec.ts` (classement de chaque urgence), `alerts.scheduler.spec.ts` (signal de vie en cas de succès et d'échec).
- e2e : `alerts-generation` (une alerte groupée par foyer, idempotence, exécutions simultanées, planification à 9 h, heure de Paris), `alerts-api` (lecture, marquage, **aucun accès aux alertes d'un autre foyer**).

## À savoir

- Les alertes sont supprimées **90 jours** après leur date par la purge nocturne (voir [maintenance/](../maintenance/README.md)).
- Les journaux ne contiennent que des nombres (alertes créées, foyers concernés) : aucun identifiant de foyer ni nom de produit.
