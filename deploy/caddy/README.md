# Reverse proxy (Caddy)

En production, Caddy est le **seul point d'entrée depuis Internet** (ports 80 et 443). Il obtient et renouvelle seul les certificats HTTPS (Let's Encrypt), redirige HTTP vers HTTPS, et transmet les requêtes au bon conteneur.

| Domaine | Destination |
|---|---|
| `miam-alert.fr` | `web:8080` (Nginx, le front) |
| `www.miam-alert.fr` | redirection permanente vers `miam-alert.fr` |
| `api.miam-alert.fr` | `api:3000` (NestJS), corps de requête limité à 64 Ko |

## Fichiers

| Fichier | Rôle |
|---|---|
| [`Caddyfile`](Caddyfile) | Configuration : domaines, en-têtes, destinations. `{$DOMAIN}` vient de la variable d'environnement `DOMAIN` |
| [`Dockerfile`](Dockerfile) | Image recompilée et non-root (voir plus bas) |

## Choix de sécurité

- **HSTS** d'un an, sous-domaines compris : pendant un an, le navigateur refuse toute connexion non chiffrée au domaine (pas de détournement vers HTTP sur un Wi-Fi piégé).
- En-tête `Server` retiré : on n'annonce pas les logiciels utilisés.
- **API d'administration désactivée** (`admin off`) : personne ne peut modifier la configuration à chaud.
- **IP réelle** : Caddy remplace le `X-Forwarded-For` envoyé par le client par la vraie IP. L'API ne fait confiance qu'à ce seul proxy (`TRUST_PROXY=1`, voir [backend/src/common/](../../backend/src/common/README.md#derrière-le-proxy)).
- Limite de 64 Ko par requête vers l'API : une première barrière, avant celle de l'API (16 Ko de JSON).
- DNS : l'enregistrement **CAA** limite l'émission de certificats pour le domaine à Let's Encrypt.

## L'image

Le binaire de l'image officielle est compilé avec une version de Go et des bibliothèques qui peuvent avoir des failles connues. Trivy en a trouvé une centaine en octobre 2026. L'image est donc **recompilée** :

1. étape `build` : `golang:1.27.3-alpine` et l'outil officiel **xcaddy**, avec une version de Caddy et des dépendances corrigées imposées (`--replace`) ;
2. image finale : `caddy:<version>-alpine` mise à jour (`apk upgrade`), utilisateur dédié `caddy`, binaire recompilé copié par-dessus.

Le binaire est copié **sans « capability »** : avec `no-new-privileges`, le noyau refuserait de lancer un binaire qui en réclame une. L'ouverture des ports 80 et 443 sans root est autorisée dans `docker-compose.prod.yml`, par le réglage `net.ipv4.ip_unprivileged_port_start: 0`, limité à ce conteneur.

Dans `docker-compose.prod.yml`, le conteneur tourne en lecture seule, sans aucune capacité, et ne démarre qu'une fois l'API et le front en bonne santé. Les certificats sont conservés dans le volume `caddy-data` : sans lui, Let's Encrypt serait sollicité à chaque redémarrage, et refuse au-delà de 5 certificats par semaine.

## Commandes

```bash
# Vérifier le Caddyfile après une modification (sans rien démarrer)
docker run --rm -e DOMAIN=example.com -v "$PWD/deploy/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2.11.7-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# Construire l'image et l'analyser comme la CI
docker build -t miam-test/proxy deploy/caddy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.75.0 \
  image --severity HIGH,CRITICAL --ignore-unfixed miam-test/proxy

# En-têtes servis en production (HSTS, absence de Server)
curl -sI https://miam-alert.fr | grep -iE '^(HTTP|strict-transport|server)'

# Dates de validité du certificat
echo | openssl s_client -connect miam-alert.fr:443 -servername miam-alert.fr 2>/dev/null | openssl x509 -noout -dates
```

**(serveur)** (`prod` : voir [docs/COMMANDES.md](../../docs/COMMANDES.md#production)) :

```bash
prod logs --tail 100 proxy    # journaux de Caddy (certificats, erreurs de connexion vers web ou api)
prod restart proxy            # pas d'API d'administration : un changement de configuration demande un redémarrage
```

## Mettre à jour Caddy

1. Changer les versions dans le `Dockerfile` (Go, xcaddy, Caddy, image finale), et ajuster ou retirer les `--replace` devenus inutiles.
2. Construire et analyser en local :
   ```bash
   docker build -t miam-test/proxy deploy/caddy
   docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.75.0 image --severity HIGH,CRITICAL --ignore-unfixed miam-test/proxy
   ```
3. La CI refait la même analyse sur chaque tag et **bloque le déploiement** si une faille haute ou critique corrigible subsiste (voir [docs/CI-CD.md](../../docs/CI-CD.md)).
