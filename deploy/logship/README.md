# Journaux hors du serveur

Toutes les 15 minutes, les journaux du serveur partent, **chiffrés**, vers une archive **impossible à modifier ou à effacer** chez Backblaze B2. Ils y restent 6 mois. Si un intrus devenait root sur le serveur, il pourrait effacer les journaux locaux, mais pas ce qui est déjà parti : les traces de son intrusion restent disponibles pour l'enquête.

```
journald (tout le serveur)                          miam-logship (toutes les 15 min)
  ├── SSH, sudo, noyau, services                     1. journalctl depuis la dernière position
  ├── conteneurs de l'application  ── pilote Docker  2. gzip + age (clé PUBLIQUE)
  └── journal d'audit  ── greffon syslog d'auditd    3. rclone → B2 (clé en écriture seule)
                                                     4. position enregistrée après succès
```

C'est une **archive** pour enquêter après coup, pas un outil de recherche avec alertes. Les journaux se consultent en les téléchargeant et en les déchiffrant sur le poste.

## Les choix

| Choix | Pourquoi |
|---|---|
| Backblaze B2 plutôt qu'un service de journaux en ligne | Les journaux contiennent des adresses IP (données personnelles). Backblaze est **déjà** le prestataire des sauvegardes, déclaré dans la politique de confidentialité, et stocke en UE : aucun nouveau destinataire des données |
| Chiffrement `age` sur le serveur, avec la clé publique des sauvegardes | Backblaze ne peut pas lire les journaux, et le serveur ne peut pas relire ce qu'il a envoyé. La clé privée reste hors ligne, chez l'administrateur |
| Bucket **dédié**, Object Lock en mode **Compliance**, 180 jours | Personne, pas même l'administrateur, ne peut effacer ou modifier un fichier avant 6 mois, la durée recommandée par la CNIL pour les journaux de sécurité |
| Clé B2 en écriture seule (`listBuckets`, `writeFiles`), propre à ce bucket | Un serveur compromis ne peut ni lire l'archive, ni la vider, ni toucher aux sauvegardes |
| Toutes les 15 minutes | Au pire, un intrus pourrait effacer les 15 dernières minutes sur le serveur |
| Position enregistrée **après** l'envoi | Un envoi raté est rattrapé au passage suivant : au pire un doublon, jamais un trou (testé) |
| Un seul flux, journald | Les conteneurs (pilote `journald` de Docker, voir `docker-compose.prod.yml`) et l'audit (greffon `syslog` d'auditd) y écrivent aussi |
| Conservation locale limitée à 30 jours et 2 Go ([`journald-miam.conf`](journald-miam.conf)) | Le journal local contient des adresses IP : on ne les garde pas plus que nécessaire |
| Service systemd isolé, **sans aucune capacité root** | Il ne fait que lire des journaux (dont root est propriétaire) et envoyer des fichiers |

## Fichiers

| Fichier | Installé dans | Rôle |
|---|---|---|
| [`miam-logship.sh`](miam-logship.sh) | `/usr/local/sbin/miam-logship` (root, 755) | Le script d'envoi |
| [`miam-logship.service`](miam-logship.service) | `/etc/systemd/system/` | Service isolé, position dans `/var/lib/miam-logship` |
| [`miam-logship.timer`](miam-logship.timer) | `/etc/systemd/system/` | Toutes les 15 minutes |
| [`logship.env.example`](logship.env.example) | `/etc/miam-logship/logship.env` (root, 600) | Clé publique age, bucket, clé B2, surveillance |
| [`journald-miam.conf`](journald-miam.conf) | `/etc/systemd/journald.conf.d/miam.conf` | Journal persistant, 30 jours, 2 Go |

## Mise en place

### 1. Bucket et clé Backblaze (poste de l'administrateur)

Dans l'interface Backblaze, même compte que les sauvegardes (région EU Central, double authentification) :
1. Nouveau bucket **privé**, par exemple `miam-alert-logs-<suffixe aléatoire>`, chiffrement par défaut activé, **Object Lock** activé, rétention par défaut **Compliance, 180 jours**.
2. Règle de cycle de vie : masquer après 180 jours, supprimer 1 jour après le masquage.

Puis la clé du serveur, avec l'outil `b2` :

```bash
b2 account authorize   # clé maître, générée dans l'interface et saisie à la main
b2 key create --bucket <bucket> miam-vps-logs-wo listBuckets,writeFiles   # résultat → gestionnaire de mots de passe
b2 key list --long     # vérifier : listBuckets,writeFiles et rien d'autre, sur ce seul bucket
b2 account clear       # la clé maître ne reste pas sur le poste
```

### 2. Installation sur le serveur

Depuis le poste, à la racine du dépôt :

```bash
scp deploy/logship/{miam-logship.sh,miam-logship.service,miam-logship.timer,logship.env.example,journald-miam.conf} miam-vps:/tmp/
ssh -t miam-vps
```

Sur le serveur :

```bash
# Journal système : persistant, 30 jours, 2 Go
sudo install -d -o root -g root -m 755 /etc/systemd/journald.conf.d
sudo install -o root -g root -m 644 /tmp/journald-miam.conf /etc/systemd/journald.conf.d/miam.conf
sudo systemctl restart systemd-journald

# Journal d'audit recopié dans le journal système
sudo sed -i 's/^active = no/active = yes/' /etc/audit/plugins.d/syslog.conf
sudo systemctl restart auditd
sudo ls /etc/sudoers.d > /dev/null; sudo journalctl --since -1min | grep -m1 root_commands   # l'événement d'audit apparaît

# Script et configuration
sudo install -o root -g root -m 755 /tmp/miam-logship.sh /usr/local/sbin/miam-logship
sudo install -d -o root -g root -m 700 /etc/miam-logship
sudo install -o root -g root -m 600 /tmp/logship.env.example /etc/miam-logship/logship.env
sudo grep '^AGE_RECIPIENT' /etc/miam-backup/backup.env    # clé publique à recopier
sudo nano /etc/miam-logship/logship.env                    # AGE_RECIPIENT, B2_BUCKET, B2_KEY_ID, B2_APPLICATION_KEY

# Service et minuterie
sudo install -o root -g root -m 644 /tmp/miam-logship.service /tmp/miam-logship.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start miam-logship.service                  # premier envoi : les dernières 24 h
sudo journalctl -u miam-logship.service -n 5 --no-pager    # « N entrées envoyées (… chiffrés) : prod/AAAA/MM/JJ/… »
sudo systemctl enable --now miam-logship.timer

rm /tmp/{miam-logship.sh,miam-logship.service,miam-logship.timer,logship.env.example,journald-miam.conf}
```

Les journaux des **conteneurs** rejoignent le journal système au premier déploiement qui contient le pilote `journald` (`docker-compose.prod.yml`, à partir de `v0.6.2`).

### 3. Vérifications de sécurité

À refaire après chaque changement de clé ou de bucket.

```bash
# Depuis le serveur, lire le bucket doit être REFUSÉ (403 / AccessDenied)
sudo bash -c 'set -a; . /etc/miam-logship/logship.env; RCLONE_CONFIG_B2_TYPE=s3 RCLONE_CONFIG_B2_PROVIDER=Other RCLONE_CONFIG_B2_ENDPOINT=${B2_S3_ENDPOINT:-https://s3.eu-central-003.backblazeb2.com} RCLONE_CONFIG_B2_ACCESS_KEY_ID=$B2_KEY_ID RCLONE_CONFIG_B2_SECRET_ACCESS_KEY=$B2_APPLICATION_KEY rclone lsf "b2:$B2_BUCKET"'
```

Dans l'interface Backblaze, un fichier envoyé doit afficher **Object Lock : Compliance Mode – Expires On …** (environ 6 mois plus tard).

## Consulter les journaux (poste de l'administrateur)

Les fichiers sont rangés par jour : `prod/AAAA/MM/JJ/<heure>-journal.json.gz.age`, une ligne JSON par entrée du journal.

```bash
b2 account authorize                                        # clé maître
b2 sync b2://<bucket>/prod/2026/10/30 ./journaux            # une journée
b2 account clear
for f in journaux/*.age; do age -d -i ~/miam-alert-backup.key "$f" | gunzip; done > journal.json

# Exemples de recherche
jq -r 'select(.SYSLOG_IDENTIFIER == "sshd") | .MESSAGE' journal.json                # connexions SSH
jq -r 'select(.MESSAGE | test("root_commands")) | .MESSAGE' journal.json            # commandes root (audit)
jq -r 'select(.SYSLOG_IDENTIFIER == "miam-alert-prod-api-1") | .MESSAGE' journal.json   # API

rm -r journaux journal.json                                 # données personnelles : ne pas les garder
```

## Commandes

**(serveur)**

```bash
systemctl list-timers miam-logship.timer --no-pager             # prochain envoi
sudo journalctl -u miam-logship.service --since today --no-pager | grep -E 'envoyées|rien|ÉCHEC|Failed'
sudo systemctl start miam-logship.service                       # envoyer maintenant
sudo cat /var/lib/miam-logship/cursor; echo                     # position atteinte dans le journal
sudo journalctl --disk-usage                                    # taille du journal local (2 Go au plus)
sudo journalctl -t miam-alert-prod-api-1 --since -1h            # journaux d'un conteneur (après v0.6.2)
```

## Revenir en arrière

```bash
sudo systemctl disable --now miam-logship.timer
sudo rm /etc/systemd/system/miam-logship.{service,timer} /usr/local/sbin/miam-logship && sudo systemctl daemon-reload
sudo sed -i 's/^active = yes/active = no/' /etc/audit/plugins.d/syslog.conf && sudo systemctl restart auditd
```

Ce qui est déjà dans le bucket y reste jusqu'à la fin de sa rétention : c'est voulu. Pour la journalisation des conteneurs, remettre le pilote `json-file` dans `docker-compose.prod.yml` (version précédente du fichier) et redéployer.

## À savoir

- **Surveillance** : `HEALTHCHECK_URL` (facultatif) reçoit un signal à chaque passage. Avec healthchecks.io, régler la période à 15 minutes et la tolérance à 30 minutes : sans signal, un email prévient que l'envoi est bloqué.
- Le premier passage envoie les dernières 24 heures ; les suivants, uniquement les nouveautés.
- Le journal d'audit reste aussi dans `/var/log/audit/` (rotation, 500 Mo) : `ausearch` y fonctionne comme avant.
- Suites possibles : alertes sur les événements de sécurité (supervision), règles d'audit immuables (`-e 2`, voir [deploy/hardening/](../hardening/README.md)).
