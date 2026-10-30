# Déploiement continu

Une version se publie en posant un tag `vX.Y.Z` sur `main`. Le pipeline GitLab de ce tag :

1. rejoue la qualité, les tests et les analyses de sécurité ;
2. **construit les 4 images** de production (API, migrations, front, proxy) et les envoie dans le registre du projet ;
3. **analyse les images avec Trivy** : une faille haute ou critique disposant d'un correctif bloque la suite ;
4. propose le job **`deploy-production`**, à lancer à la main (bouton « play »).

Ce job se connecte au serveur avec l'utilisateur `deploy`, qui ne peut faire **qu'une seule chose** : lancer `miam-deploy` avec un numéro de version. Le script télécharge les images de cette version, applique les migrations, redémarre les services et vérifie que l'API répond.

## Barrières de sécurité

| Barrière | Ce qu'elle empêche |
|---|---|
| Clé SSH du job limitée par `authorized_keys` (`restrict,command=…`) | Ouvrir un shell, transférer des ports ou exécuter une autre commande |
| Règle `sudo` limitée au script **et** à un argument `^v[0-9]+\.[0-9]+\.[0-9]+$` | Lancer autre chose en root, ou injecter des options ou des commandes (testé) |
| Validation de la version dans le script | Deuxième contrôle, au cas où la règle sudo serait modifiée |
| `deploy` n'est pas dans le groupe `docker` | Ce groupe équivaut à root sans mot de passe |
| Variables `DEPLOY_*` protégées dans GitLab | La clé n'est fournie qu'aux pipelines des tags protégés `v*` |
| Empreinte du serveur fixée (`DEPLOY_KNOWN_HOSTS`) | Se connecter à un faux serveur (homme du milieu) |
| Jeton de registre en lecture seule sur le serveur | Un serveur compromis ne peut pas modifier les images publiées |

Si la clé du job fuit, la seule action possible est de **redéployer une version déjà publiée et analysée**.

## Installation sur le serveur (une fois)

Depuis le poste de l'administrateur, copier les fichiers :

```bash
scp deploy/server/miam-deploy.sh deploy/server/sudoers-miam-deploy miam-vps:/tmp/
ssh -t miam-vps
```

Puis sur le serveur :

```bash
# 1. Script et règle sudo (vérifiée avant installation : une erreur de syntaxe bloquerait sudo)
sudo install -o root -g root -m 755 /tmp/miam-deploy.sh /usr/local/sbin/miam-deploy
sudo visudo -cf /tmp/sudoers-miam-deploy && sudo install -o root -g root -m 440 /tmp/sudoers-miam-deploy /etc/sudoers.d/miam-deploy

# 2. Utilisateur deploy (sans mot de passe, connexion par clé uniquement)
sudo adduser --disabled-password --gecos "" --shell /bin/sh deploy
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh

# 3. Clé publique du job, limitée à la commande de déploiement (remplacer CLE_PUBLIQUE)
echo 'restrict,command="sudo -n /usr/local/sbin/miam-deploy \"$SSH_ORIGINAL_COMMAND\"" CLE_PUBLIQUE' \
  | sudo tee /home/deploy/.ssh/authorized_keys >/dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys

# 4. Autoriser deploy à se connecter en SSH
sudo sed -i 's/^AllowUsers kabo$/AllowUsers kabo deploy/' /etc/ssh/sshd_config.d/00-hardening.conf
sudo sshd -t && sudo systemctl reload ssh

# 5. Accès en lecture au registre GitLab (jeton de déploiement « read_registry »)
sudo docker login registry.gitlab.com -u NOM_DU_JETON

rm /tmp/miam-deploy.sh /tmp/sudoers-miam-deploy
```

## Configuration GitLab (une fois)

*Settings → CI/CD → Variables*, toutes **protégées** :

| Variable | Type | Valeur |
|---|---|---|
| `DEPLOY_HOST` | Variable | adresse IP du serveur |
| `DEPLOY_SSH_KEY` | **File** | clé **privée** du job |
| `DEPLOY_KNOWN_HOSTS` | Variable | ligne `known_hosts` du serveur (clé ED25519) |

*Settings → Repository → Deploy tokens* : jeton avec la seule portée `read_registry`, utilisé à l'étape 5.

## Utilisation

- **Publier** : tag `vX.Y.Z` sur `main`, puis bouton « play » du job `deploy-production` dans le pipeline du tag.
- **Revenir en arrière** : relancer le job `deploy-production` du pipeline de la version précédente (*Build → Pipelines*, ou *Operate → Environments → production*).
- **Déploiement manuel de secours** (si GitLab est indisponible) : `ssh -t miam-vps 'sudo /usr/local/sbin/miam-deploy vX.Y.Z'`, ou construction locale sur le serveur (voir l'en-tête de `docker-compose.prod.yml`).

## Commandes

```bash
# Déployer une version à la main (secours, si GitLab est indisponible)
ssh -t miam-vps 'sudo /usr/local/sbin/miam-deploy vX.Y.Z'

# Version des fichiers en place sur le serveur
ssh miam-vps 'git -C ~/miam-alert describe --tags'

# Vérifier en ligne
curl -s https://api.miam-alert.fr/health
```

**(serveur)** Vérifier l'installation :

```bash
sudo visudo -cf /etc/sudoers.d/miam-deploy                # règle sudo valide
sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys     # empreinte de la clé autorisée pour le job
sudo test -f /root/.docker/config.json && echo "registre : connecté"
sudo journalctl _COMM=sudo --since today | grep miam-deploy   # déploiements lancés aujourd'hui
```

Le journal d'un déploiement lancé par GitLab est dans le job `deploy-production` du pipeline.
