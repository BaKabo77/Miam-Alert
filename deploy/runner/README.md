# Runner GitLab sur le poste de développement

L'offre gratuite de GitLab.com ne donne que 400 minutes de calcul par mois sur ses machines partagées. Le pipeline complet (tests e2e, SAST, construction des 4 images) les épuise vite. Une fois à zéro, plus aucun pipeline ne tourne, et plus aucune MR ne peut être fusionnée.

Les jobs tournent donc sur le **poste du développeur**, dans Docker Desktop, sans limite de minutes. Ce n'est **jamais sur le serveur de production** : la CI exécute du code et construit des images, elle n'a rien à faire à côté des données des utilisateurs.

Un seul conteneur `gitlab-runner` héberge deux runners :

| Runner | Jobs | Restrictions |
|---|---|---|
| `miam-pc` | tous les jobs sans tag (qualité, tests, sécurité, Trivy, déploiement) | aucun privilège, aucun accès au Docker du poste |
| `miam-pc-docker-build` | uniquement `build-images` (tag `docker-build`) | **protégé** (tags `v*` seulement) ; images `docker:*` uniquement ; seul le service `docker:*-dind` est privilégié |

## Barrières de sécurité

| Barrière | Ce qu'elle empêche |
|---|---|
| Runner sur le poste, pas sur le serveur | Qu'un job compromis (dépendance npm malveillante) atteigne la production ou ses données |
| Socket Docker jamais monté dans les jobs | Qu'un job prenne le contrôle de Docker Desktop (les autres conteneurs, la base de dev) |
| Privilèges réservés au service `docker:*-dind` du runner protégé | Qu'un job de branche obtienne un conteneur privilégié |
| `allowed_images` / `allowed_services` du runner protégé | Qu'un job ajoute une autre image au runner privilégié |
| Docker Desktop : les conteneurs privilégiés le sont dans **sa machine virtuelle** | Qu'une évasion de conteneur atteigne directement le système du poste |
| Jeton saisi masqué (`read -s`), stocké seulement dans le volume `gitlab-runner-config` | Qu'il apparaisse dans le dépôt, l'historique du shell ou la liste des processus |
| Runners partagés de GitLab désactivés pour le projet | Que des jobs (et les variables protégées) partent sur des machines tierces sans qu'on le décide |

Limites assumées :
- Le conteneur `gitlab-runner` a accès au socket Docker : c'est nécessaire pour lancer les jobs, et cela le rend administrateur de Docker Desktop.
- Pendant un pipeline de tag, la clé de déploiement (`DEPLOY_SSH_KEY`) passe par le poste. Le poste détient déjà la clé d'administration du serveur, plus puissante. Le runner efface les variables de type fichier à la fin du job.
- Quand le poste est éteint, les pipelines restent en attente (*pending*). Ils démarrent dès que Docker Desktop est relancé.
- **Avant d'accueillir un contributeur**, sortir le runner du poste personnel : une machine virtuelle dédiée et jetable. Sinon, le code de ses branches s'exécuterait chez le développeur.

## Installation (une fois)

Docker Desktop : *Settings → Resources*, mémoire à **6 Go** au moins. La construction de Caddy (Go) et celle du front s'exécutent en parallèle.

### 1. Démarrer le service

```bash
docker volume create gitlab-runner-config
docker run -d --name gitlab-runner --restart unless-stopped \
  -v gitlab-runner-config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:alpine-v19.5.2
```

### 2. Créer les deux runners dans GitLab

*Settings → CI/CD → Runners → New project runner*, plateforme Linux :

| | `miam-pc` | `miam-pc-docker-build` |
|---|---|---|
| Tags | *(aucun)* | `docker-build` |
| Run untagged jobs | coché | **décoché** |
| Protected | décoché | **coché** |

Chaque création affiche un jeton `glrt-…`, **une seule fois**. On ne copie que le jeton, pas la commande proposée.

### 3. Enregistrer les runners sur le poste

Depuis la racine du dépôt, une fois par runner. Le jeton est saisi masqué :

```bash
read -rsp 'Jeton du runner miam-pc : ' CI_SERVER_TOKEN; echo; export CI_SERVER_TOKEN
docker run --rm -e CI_SERVER_TOKEN -v gitlab-runner-config:/etc/gitlab-runner \
  -v "$PWD/deploy/runner/general.toml:/template.toml:ro" gitlab/gitlab-runner:alpine-v19.5.2 \
  register --non-interactive --url https://gitlab.com --executor docker \
  --docker-image alpine:3.24 --name miam-pc --template-config /template.toml
unset CI_SERVER_TOKEN

read -rsp 'Jeton du runner miam-pc-docker-build : ' CI_SERVER_TOKEN; echo; export CI_SERVER_TOKEN
docker run --rm -e CI_SERVER_TOKEN -v gitlab-runner-config:/etc/gitlab-runner \
  -v "$PWD/deploy/runner/docker-build.toml:/template.toml:ro" gitlab/gitlab-runner:alpine-v19.5.2 \
  register --non-interactive --url https://gitlab.com --executor docker \
  --docker-image docker:29.9.0 --name miam-pc-docker-build --template-config /template.toml
unset CI_SERVER_TOKEN
```

Puis autoriser deux jobs en parallèle (le service relit sa configuration tout seul) :

```bash
docker run --rm -v gitlab-runner-config:/etc/gitlab-runner alpine:3.24 \
  sed -i 's/^concurrent = .*/concurrent = 2/' /etc/gitlab-runner/config.toml
```

### 4. Couper les runners partagés

*Settings → CI/CD → Runners → Instance runners* : désactiver « Enable instance runners for this project ». Les deux runners du poste doivent apparaître avec une pastille verte.

## Exploitation

- **Journal** : `docker logs -f gitlab-runner`. Le journal ne contient jamais le jeton complet. `gitlab-runner list`, lui, l'affiche : éviter cette commande.
- **Mettre à jour** : changer la version ici, puis `docker rm -f gitlab-runner` et relancer l'étape 1. La configuration est conservée dans le volume.
- **Faire de la place** : `docker system df`. Les caches des jobs sont dans des volumes `runner-…`, à supprimer quand le runner ne tourne pas : `docker volume ls -q -f name=runner- | xargs -r docker volume rm`.
- **Poste indisponible et pipeline urgent** : réactiver temporairement les runners partagés (cela consomme des minutes). `build-images` n'y tournera pas, à cause de son tag `docker-build`.
- **Révoquer** (poste perdu ou compromis) : supprimer les deux runners dans *Settings → CI/CD → Runners*. Leurs jetons deviennent immédiatement invalides.
