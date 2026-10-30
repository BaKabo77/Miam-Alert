# Sauvegardes de la base de production

Chaque nuit, la base PostgreSQL de production est copiée, **restaurée à l'essai**, **chiffrée**, puis conservée sur le serveur (7 jours) et envoyée hors du serveur sur Backblaze B2, dans l'UE, où elle est **impossible à supprimer pendant 30 jours**.

```
03 h (Paris) ─ miam-backup.timer
   └─ miam-backup.sh (root)
        1. pg_dump ─────────────► copie en clair (dossier temporaire privé, effacée à la fin)
        2. restauration de test ─► PostgreSQL jetable, sans réseau : on ne garde que ce qui se restaure
        3. age (clé PUBLIQUE) ──► miam-alert-<date>.dump.age
        4a. /var/backups/miam-alert ──────────────► 7 jours (restauration rapide)
        4b. Backblaze B2, EU Central (API S3) ────► 30 jours, Object Lock (immuable)
```

**Perte de données maximale en cas de panne : 24 heures** (une sauvegarde par nuit).

---

## Fichiers de ce dossier

| Fichier | Rôle | Installé sur le serveur dans |
|---|---|---|
| `miam-backup.sh` | Le script de sauvegarde | `/usr/local/sbin/miam-backup` (root, 755) |
| `miam-backup.service` | Service systemd qui lance le script, durci | `/etc/systemd/system/` |
| `miam-backup.timer` | Déclenchement chaque nuit à 3 h, heure de Paris | `/etc/systemd/system/` |
| `backup.env.example` | Modèle de configuration (valeurs factices) | `/etc/miam-backup/backup.env` (root, 600) |

Le dépôt ne contient **aucun secret** : la vraie configuration n'existe que sur le serveur.

## Les clés : où elles sont, que faire si on les perd

| Clé | Où | Rôle | Si elle est perdue ou volée |
|---|---|---|---|
| **Clé privée age** (`AGE-SECRET-KEY-1…`) | Poste de l'administrateur (`~/miam-alert-backup.key`) + gestionnaire de mots de passe. **Jamais sur le serveur.** | Déchiffrer les sauvegardes | **Perdue : toutes les sauvegardes sont illisibles, définitivement.** C'est la seule clé irremplaçable : en garder deux copies hors ligne. Volée : générer une nouvelle paire, mettre la nouvelle clé publique sur le serveur (les anciennes sauvegardes restent lisibles avec l'ancienne). |
| **Clé publique age** (`age1…`) | `backup.env` sur le serveur | Chiffrer | Pas un secret. Retrouvable avec `age-keygen -y ~/miam-alert-backup.key`. |
| **Clé Backblaze du serveur** (keyID + applicationKey) | `backup.env` sur le serveur uniquement | Déposer les fichiers | Remplaçable en deux minutes (voir « Remplacer la clé Backblaze »). Volée : un attaquant ne peut que déposer des fichiers, ni lire, ni lister, ni supprimer. |
| **Clé maître Backblaze** | Nulle part : régénérée dans l'interface au besoin, puis effacée (`b2 account clear`) | Créer ou supprimer des clés | Régénérer une clé maître annule la précédente. |
| **Compte Backblaze** | Mot de passe + double authentification | Administrer le bucket | Même avec ce compte, une sauvegarde verrouillée ne peut pas être supprimée avant 30 jours. |

## Les choix de sécurité

| Choix | Raison |
|---|---|
| Chiffrement **asymétrique** (age) | Le serveur peut chiffrer mais pas déchiffrer : un attaquant qui le compromet ne lit pas les anciennes sauvegardes. |
| Chiffrement **avant** l'envoi | Backblaze ne voit qu'un fichier illisible : les données personnelles ne sortent jamais en clair (RGPD). Backblaze ajoute son propre chiffrement AES-256. |
| Restauration de test à chaque sauvegarde | Une sauvegarde jamais restaurée n'est qu'une hypothèse. Le script compare le nombre de migrations restaurées à celui de la production et s'arrête en cas d'écart. |
| Clé Backblaze limitée à `listBuckets` et `writeFiles`, sur un seul bucket | Le serveur dépose des fichiers mais ne peut ni les lister ni les lire (testé : `403`). L'option « Write Only » de l'interface web donnait aussi `deleteFiles` : la clé est créée avec l'outil `b2`. |
| **Object Lock, mode Compliance, 30 jours** | `writeFiles` permet encore de *masquer* un fichier (une « suppression » S3 répond `204`), et la règle de cycle de vie supprime ensuite les fichiers masqués : un attaquant aurait pu faire effacer les sauvegardes par Backblaze. Avec le verrouillage, aucune version ne peut être supprimée avant 30 jours, par personne, clé maître comprise. **Faille trouvée en testant la suppression, pas en la déduisant des droits de la clé.** |
| Rotation externe faite par Backblaze, jamais par le serveur | Le serveur n'a aucun droit de suppression, donc rien à supprimer lui-même. |
| Stockage hors d'IONOS | Un incident chez l'hébergeur du serveur (panne, compte bloqué) n'emporte pas les sauvegardes. |
| Script dans `/usr/local/sbin`, propriété de root | systemd l'exécute en root : s'il restait dans le dépôt cloné (propriété de `kabo`), modifier ce fichier permettrait d'exécuter n'importe quoi en root. |
| Service systemd durci | Système en lecture seule sauf le dossier des sauvegardes, `/tmp` privé, aucun gain de privilèges. |
| Mot de passe de la base jamais lu par le script | `pg_dump` est lancé dans le conteneur de la base, avec ses propres variables. |
| Logs avec des nombres seulement | Le journal affiche des comptes (migrations, comptes, articles), jamais une donnée personnelle ni une clé. |
| API S3 plutôt que l'API native de B2 | Le rclone d'Ubuntu 24.04 utilise la version 1 de l'API native, refusée par Backblaze ; via S3, on garde le paquet d'Ubuntu et ses correctifs de sécurité automatiques au lieu d'un binaire installé à la main. |

---

## Commandes

Toutes se lancent depuis le poste de l'administrateur (`miam-vps` est l'alias SSH du serveur) et demandent le mot de passe `sudo`.

**La sauvegarde de cette nuit s'est-elle bien passée ?**
```bash
ssh -t miam-vps 'sudo journalctl -u miam-backup.service --since today --no-pager | tail -5'
```
Une sauvegarde réussie se termine par `terminé : miam-alert-<date>.dump.age (<taille>)`.

**Prochaine exécution prévue**
```bash
ssh -t miam-vps 'systemctl list-timers miam-backup.timer --no-pager'
```

**Lancer une sauvegarde tout de suite** (avant une migration risquée, par exemple)
```bash
ssh -t miam-vps 'sudo systemctl start miam-backup.service && sudo journalctl -u miam-backup.service -n 8 --no-pager'
```

**Historique des dernières sauvegardes**
```bash
ssh -t miam-vps 'sudo journalctl -u miam-backup.service --since "-7 days" --no-pager | grep -E "terminé|ÉCHEC"'
```

**Sauvegardes conservées sur le serveur**
```bash
ssh -t miam-vps 'sudo ls -lh /var/backups/miam-alert'
```

**Sauvegardes sur Backblaze** : uniquement depuis l'interface web (*Buckets*, puis *Browse Files*). Le serveur n'a volontairement pas le droit de les lister.

**Suspendre ou réactiver les sauvegardes nocturnes**
```bash
ssh -t miam-vps 'sudo systemctl disable --now miam-backup.timer'   # suspendre
ssh -t miam-vps 'sudo systemctl enable --now miam-backup.timer'    # réactiver
```

**Mettre à jour le script après une modification dans le dépôt**
```bash
scp deploy/backup/miam-backup.sh miam-vps:/tmp/
ssh -t miam-vps 'sudo install -o root -g root -m 755 /tmp/miam-backup.sh /usr/local/sbin/miam-backup && rm /tmp/miam-backup.sh'
```
Même principe pour `.service` et `.timer` (dans `/etc/systemd/system/`, droits 644), suivi de `sudo systemctl daemon-reload`.

**Modifier la configuration**
```bash
ssh -t miam-vps 'sudoedit /etc/miam-backup/backup.env'
```

---

## Restaurer une sauvegarde

À faire depuis le poste de l'administrateur, le seul à détenir la clé privée.

**1. Récupérer et déchiffrer**

Télécharger `miam-alert-<date>.dump.age` depuis l'interface Backblaze, puis :
```bash
age --decrypt --identity ~/miam-alert-backup.key --output miam-alert.dump miam-alert-<date>.dump.age
```

**2. Vérifier par une restauration d'essai** (conseillé tous les trois mois)
```bash
docker run -d --name restore-check -e POSTGRES_PASSWORD=essai postgres:16-alpine && sleep 5
docker cp miam-alert.dump restore-check:/tmp/
docker exec restore-check pg_restore -U postgres -d postgres --exit-on-error --no-owner /tmp/miam-alert.dump
docker exec restore-check psql -U postgres -c 'SELECT count(*) AS comptes FROM "User"' -c 'SELECT count(*) AS articles FROM "PantryItem"'
docker rm -f restore-check
shred -u miam-alert.dump   # la copie en clair ne doit pas rester sur le poste
```
Les nombres doivent correspondre à la ligne `restauration OK : …` du journal du serveur pour cette date.

**3. Restaurer en production** (base corrompue, données effacées par erreur, serveur perdu)

Sur un serveur où la pile tourne (au besoin réinstallé selon le README principal) :
```bash
scp miam-alert.dump miam-vps:/tmp/
ssh -t miam-vps
cd ~/miam-alert
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod stop api   # plus aucune écriture
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < /tmp/miam-alert.dump
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod start api
shred -u /tmp/miam-alert.dump
```
Puis vérifier `https://api.miam-alert.fr/health` et la connexion d'un compte. Les sessions restent valides si le secret JWT n'a pas changé ; sinon, chacun se reconnecte.

**Récupérer une sauvegarde masquée** : dans l'interface Backblaze, activer l'affichage de toutes les versions ; une version verrouillée reste téléchargeable même si le fichier apparaît comme masqué.

---

## Mise en place complète (nouveau serveur ou nouveau compte)

### Clés de chiffrement (poste de l'administrateur)
```bash
sudo apt install age
age-keygen -o ~/miam-alert-backup.key   # affiche la clé publique age1…
```
Copier les trois lignes du fichier dans le gestionnaire de mots de passe (et sur un support hors ligne). Ne jamais coller la ligne `AGE-SECRET-KEY-1…` ailleurs.

### Stockage Backblaze B2
1. Compte en région **EU Central** (choix définitif), **double authentification** activée.
2. Bucket **privé**, chiffrement par défaut activé, **Object Lock** activé, rétention par défaut **Compliance, 30 jours**.
3. Règle de cycle de vie : masquer après 30 jours, supprimer 1 jour après le masquage.
4. Clé du serveur, créée depuis le poste de l'administrateur avec l'outil `b2` (`pipx install b2`) :
```bash
b2 account authorize   # clé maître, générée dans l'interface et saisie à la main
b2 key create --bucket <bucket> miam-vps-backup-wo listBuckets,writeFiles   # résultat → gestionnaire de mots de passe
b2 key list --long     # vérifier : listBuckets,writeFiles et rien d'autre
b2 account clear       # la clé maître ne reste pas sur le poste
```

### Installation sur le serveur
Copier les fichiers de ce dossier dans `/tmp/miam-backup/` sur le serveur, puis :
```bash
sudo apt install age rclone
cd /tmp/miam-backup
sudo install -o root -g root -m 755 miam-backup.sh /usr/local/sbin/miam-backup
sudo install -o root -g root -m 644 miam-backup.service miam-backup.timer /etc/systemd/system/
sudo install -d -o root -g root -m 700 /etc/miam-backup /var/backups/miam-alert
sudo install -o root -g root -m 600 backup.env.example /etc/miam-backup/backup.env
sudoedit /etc/miam-backup/backup.env       # clé publique age, bucket, keyID, applicationKey
sudo systemctl daemon-reload
sudo systemctl start miam-backup.service   # premier essai
sudo journalctl -u miam-backup.service -n 15 --no-pager
sudo systemctl enable --now miam-backup.timer
rm -rf /tmp/miam-backup
```

### Remplacer la clé Backblaze (fuite, rotation)
1. Créer une nouvelle clé avec `b2 key create` (voir plus haut).
2. `sudoedit /etc/miam-backup/backup.env` : mettre à jour `B2_KEY_ID` et `B2_APPLICATION_KEY`.
3. Lancer une sauvegarde manuelle et vérifier qu'elle se termine.
4. Supprimer l'ancienne clé : `b2 key delete <ancien keyID>`.

### Tests de sécurité à refaire après chaque changement de clé ou de bucket
- Lister le bucket depuis le serveur doit être **refusé** (`403`).
- Une sauvegarde envoyée doit afficher, dans l'interface Backblaze, **Object Lock : Compliance Mode – Expires On …**.

---

## Dépannage

| Message | Signification |
|---|---|
| `NOTICE: Config file "/root/.rclone.conf" not found` | Normal : rclone est configuré par variables d'environnement, sans fichier. |
| `This request is not currently supported on API version number 1` | rclone utilise l'API native de B2 au lieu de l'API S3 : vérifier que le script installé est à jour. |
| `403` à l'envoi | Clé supprimée, mauvais keyID ou applicationKey, ou clé limitée à un autre bucket. |
| `ÉCHEC : X migrations restaurées sur Y` | La copie est incomplète : rien n'a été conservé ni envoyé. Relancer à la main et lire le journal complet. |
| `pg_restore: error …` pendant la restauration de test | La copie est inutilisable : rien n'a été conservé ni envoyé. Vérifier l'état de la base (`docker compose … logs db`). |
| Erreur Docker (`Cannot connect to the Docker daemon`) | Docker est arrêté : `sudo systemctl status docker`. |

## Limites connues et améliorations prévues

- **Aucune alerte en cas d'échec** tant que `HEALTHCHECK_URL` est vide : un échec n'apparaît que dans le journal. Prévu : un service comme healthchecks.io, qui envoie un email si la sauvegarde ne s'est pas signalée.
- **Jusqu'à 24 heures de données perdues** en cas de panne. Suffisant pour un inventaire de cuisine ; une application critique utiliserait l'archivage continu du journal de PostgreSQL (WAL).
- Les sauvegardes locales sur le serveur ne protègent que d'une erreur de manipulation, pas d'une perte du serveur : c'est le rôle de la copie Backblaze.

## Calendrier d'entretien

| Fréquence | Action |
|---|---|
| Chaque semaine (ou automatiquement, une fois la surveillance en place) | Vérifier l'historique des sauvegardes |
| Tous les trois mois | Restauration d'essai complète depuis le poste de l'administrateur |
| Chaque année | Renouveler la clé Backblaze du serveur ; vérifier que la clé privée age est toujours accessible dans le gestionnaire de mots de passe |
