# Sauvegardes de la base de production

Chaque nuit à 3 h (heure de Paris), `miam-backup.timer` lance `miam-backup.sh` :

1. **Copie** de la base avec `pg_dump` (cohérente, sans arrêter l'application).
2. **Restauration de test** dans un PostgreSQL jetable et sans réseau : la sauvegarde n'est conservée que si elle se restaure et contient toutes les migrations.
3. **Chiffrement** avec [age](https://age-encryption.org), à l'aide de la clé **publique** seulement.
4. **Copie locale** dans `/var/backups/miam-alert` (7 jours) et **copie externe** sur Backblaze B2, région UE (30 jours).

| Choix | Raison |
|---|---|
| Chiffrement asymétrique | Le serveur peut chiffrer mais pas déchiffrer : un attaquant qui le compromet ne lit pas les anciennes sauvegardes. La clé privée est conservée hors ligne par l'administrateur. |
| Chiffrement avant l'envoi | L'hébergeur du stockage ne voit qu'un fichier illisible (RGPD). |
| Clé Backblaze limitée à `listBuckets` et `writeFiles` (créée avec l'outil `b2` : l'option « Write Only » de l'interface autorise aussi la suppression) | Le serveur dépose des fichiers mais ne peut ni les lire ni les supprimer : un attaquant ou un rançongiciel ne peut pas effacer les copies externes. La rotation (30 jours) est faite par une règle de cycle de vie de Backblaze. |
| Stockage hors d'IONOS | Un incident chez l'hébergeur du serveur n'emporte pas les sauvegardes. |
| Script copié dans `/usr/local/sbin`, propriété de root | systemd l'exécute en root : il ne doit pas être modifiable par un utilisateur ordinaire (le dépôt cloné appartient à `kabo`). |
| Service systemd durci | Système en lecture seule sauf le dossier des sauvegardes, `/tmp` privé, aucun gain de privilèges. |

Perte de données maximale en cas de panne : 24 heures (une sauvegarde par nuit).

## Installation sur le serveur

```bash
sudo apt install age rclone
sudo install -o root -g root -m 755 deploy/backup/miam-backup.sh /usr/local/sbin/miam-backup
sudo install -o root -g root -m 644 deploy/backup/miam-backup.service deploy/backup/miam-backup.timer /etc/systemd/system/
sudo install -d -o root -g root -m 700 /etc/miam-backup /var/backups/miam-alert
sudo install -o root -g root -m 600 deploy/backup/backup.env.example /etc/miam-backup/backup.env
sudoedit /etc/miam-backup/backup.env      # renseigner les valeurs
sudo systemctl daemon-reload
sudo systemctl start miam-backup.service  # premier essai, puis :
sudo journalctl -u miam-backup.service -n 30
sudo systemctl enable --now miam-backup.timer
```

Après chaque modification du script dans le dépôt, refaire la commande `install` correspondante.

## Restaurer une sauvegarde

À faire depuis le poste de l'administrateur, qui détient la clé privée (`~/miam-alert-backup.key`).

**1. Récupérer et déchiffrer**

Télécharger le fichier `miam-alert-<date>.dump.age` depuis l'interface Backblaze, puis :

```bash
age --decrypt --identity ~/miam-alert-backup.key --output miam-alert.dump miam-alert-<date>.dump.age
```

**2. Vérifier (restauration d'essai, conseillée tous les trois mois)**

```bash
docker run -d --name restore-check -e POSTGRES_PASSWORD=essai postgres:16-alpine
sleep 5
docker cp miam-alert.dump restore-check:/tmp/
docker exec restore-check pg_restore -U postgres -d postgres --exit-on-error --no-owner /tmp/miam-alert.dump
docker exec restore-check psql -U postgres -c 'SELECT count(*) FROM "User"'
docker rm -f restore-check
shred -u miam-alert.dump   # la copie en clair ne doit pas traîner sur le poste
```

**3. Restaurer en production (perte de la base ou du serveur)**

Sur un serveur où la pile tourne (au besoin, réinstallée selon le README) :

```bash
scp miam-alert.dump miam-vps:/tmp/
ssh miam-vps
cd ~/miam-alert
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod stop api   # plus d'écritures pendant la restauration
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < /tmp/miam-alert.dump
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod start api
shred -u /tmp/miam-alert.dump
```

Puis vérifier `https://api.miam-alert.fr/health` et la connexion d'un compte. Les sessions en cours restent valides si le secret JWT n'a pas changé ; sinon, chacun se reconnecte.
