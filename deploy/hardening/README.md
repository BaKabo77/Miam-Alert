# Durcissement du serveur

Réglages du système du serveur de production (VPS IONOS, Ubuntu 24.04), en plus de ce qui était déjà en place :
- connexion SSH par clé uniquement, root interdit ;
- pare-feu `ufw` (22, 80, 443) et `fail2ban` ;
- mises à jour de sécurité automatiques ;
- conteneurs non-root, en lecture seule, sans capacités.

Le but est de **réduire ce qu'un attaquant peut faire** sur le serveur, et de **garder une trace** de ce qui s'y passe. Les choix suivent les suggestions de **Lynis** (outil d'audit), triées une à une (voir plus bas).

| Fichier | Installé dans | Rôle |
|---|---|---|
| [`52unattended-upgrades-miam`](52unattended-upgrades-miam) | `/etc/apt/apt.conf.d/` | Redémarrage automatique après une mise à jour du noyau |
| [`99-miam-hardening.conf`](99-miam-hardening.conf) | `/etc/sysctl.d/` | Réglages du noyau (réseau, mémoire, vidages mémoire) |
| [`miam-modules.conf`](miam-modules.conf) | `/etc/modprobe.d/` | Modules du noyau inutiles interdits de chargement |
| [`90-miam-nocore.conf`](90-miam-nocore.conf) | `/etc/security/limits.d/` | Aucun vidage mémoire dans les sessions |
| [`00-hardening.conf`](00-hardening.conf) | `/etc/ssh/sshd_config.d/` | Configuration SSH complète (versionnée ici depuis la v0.6) |
| [`miam.rules`](miam.rules) | `/etc/audit/rules.d/50-miam.rules` | Règles du journal d'audit |
| [`issue`](issue) | `/etc/issue`, `/etc/issue.net` | Bannière légale de connexion |
| [`fail2ban-miam.local`](fail2ban-miam.local) | `/etc/fail2ban/fail2ban.d/miam.local` | Réglage général de fail2ban |
| [`lynis-custom.prf`](lynis-custom.prf) | `/etc/lynis/custom.prf` | Écarts acceptés par Lynis, chacun justifié |
| aucun (commandes `dpkg-statoverride`) | `/etc/crontab`, `/etc/cron.*`, `/etc/ssh/sshd_config` | Permissions réservées à root |

## Les choix

### Redémarrage automatique
Les mises à jour automatiques installent chaque jour les correctifs du noyau et des bibliothèques de base, mais ceux-ci **ne s'appliquent qu'au redémarrage**. Sans lui, le serveur peut tourner des semaines avec un noyau vulnérable déjà corrigé sur le disque.

- Redémarrage **seulement quand il est nécessaire** (fichier `/var/run/reboot-required`).
- À **03:30 UTC** (le serveur est en UTC), soit 4 h 30 à Paris en hiver et 5 h 30 en été. C'est toujours après la sauvegarde (3 h à Paris) et la purge de l'API (4 h à Paris).
- Une à deux minutes d'interruption : Docker démarre avec le système et les conteneurs repartent seuls (`restart: unless-stopped`).
- Un correctif installé vers 6 h UTC attend le redémarrage de la nuit suivante.

### Noyau
Ubuntu durcit déjà beaucoup de choses (BPF non privilégié désactivé, protection des liens, ASLR…). [`99-miam-hardening.conf`](99-miam-hardening.conf) ne change que ce qui reste ; chaque ligne y est commentée :
- **réseau** : filtrage strict de l'adresse source (paquets usurpés rejetés), aucune redirection ICMP envoyée ni acceptée, routage par la source refusé aussi sur les interfaces que Docker crée, paquets aux adresses impossibles journalisés ;
- **mémoire** : adresses du noyau masquées à tous, lecture de la mémoire d'un autre processus (`ptrace`) réservée à l'administrateur, BPF interdit aux non-administrateurs et compilateur BPF durci, pas de remplacement du noyau à chaud (`kexec`), touches « magiques » désactivées ;
- **vidages mémoire** (*core dumps*) : interdits, car ils contiennent toute la mémoire d'un processus, donc des secrets. Apport, l'outil de rapport de plantage d'Ubuntu, est désactivé : il collecte ces vidages et remplacerait le réglage.

[`miam-modules.conf`](miam-modules.conf) interdit le chargement de modules dont rien ne se sert ici, et qui ont un historique de failles permettant de devenir root : protocoles réseau rares (`dccp`, `sctp`, `rds`, `tipc`) et clés USB.

⚠️ `net.ipv4.ip_forward` reste à 1 : Docker en a besoin pour faire passer le trafic vers les conteneurs. Le fichier n'y touche pas.

### SSH
[`00-hardening.conf`](00-hardening.conf) est la configuration complète. Ce qui change par rapport à la version précédente :
- **plus aucun transfert** (`DisableForwarding`, tunnels compris) : une clé volée ne donne plus de passage réseau vers la base, sur le réseau interne de Docker. L'accès à la base passe par `sudo docker compose exec db psql` ;
- **journal `VERBOSE`** : l'empreinte de la clé utilisée est enregistrée à chaque connexion, ce qui permet de savoir quelle clé révoquer après un incident ;
- deux sessions au plus par connexion ; keepalive TCP (en clair, falsifiable) remplacé par le contrôle chiffré déjà en place.

Le port reste 22 : en changer serait de la sécurité par l'obscurité. Cela casserait l'empreinte connue de la CI et la config de fail2ban, et les clés suffisent.

La clé de déploiement de GitLab n'est pas concernée : `authorized_keys` lui interdit déjà tout transfert (`restrict`).

### Journal d'audit (auditd)
Le noyau enregistre les actions sensibles, et `ausearch` permet de répondre à « **qui a fait quoi, et quand** » : c'est la traçabilité attendue en environnement ISO 27001.

| Clé | Ce qui est tracé |
|---|---|
| `root_commands` | **Chaque commande lancée en root par une personne connectée** (via sudo), avec son utilisateur de connexion |
| `identity`, `sudoers` | Modification des comptes, groupes, mots de passe, règles sudo |
| `sshd_config`, `ssh_keys` | Modification de la configuration SSH ou des clés autorisées (kabo, deploy, root) |
| `deploy`, `admin_scripts` | Lancement de `miam-deploy`, modification des scripts de `/usr/local/sbin` |
| `app_secrets` | Lecture ou modification de `.env.prod` et de la configuration des sauvegardes |
| `systemd`, `docker_config`, `firewall`, `cron`, `sysctl`, `apt_config` | Modification des services, de Docker, du pare-feu, des tâches planifiées, des réglages du noyau, des mises à jour |
| `kernel_modules` | Chargement ou retrait d'un module du noyau |
| `audit_config` | Modification de la configuration de l'audit elle-même |

- **Sans bruit** : les processus des conteneurs, de Docker et des tâches planifiées n'ont pas d'utilisateur de connexion (`auid` non défini). Seuls les gestes des personnes sont tracés, sauf pour les fichiers surveillés : la sauvegarde de la nuit apparaît, par exemple, dans `app_secrets`.
- **Taille bornée** : 10 fichiers de 50 Mo, avec rotation (au lieu de 5 × 8 Mo par défaut), pour garder plusieurs mois d'historique sans remplir le disque.
- Le journal ne contient aucun contenu de fichier, seulement qui y a accédé.

### Bannière et fail2ban
- **Bannière** : rappelle avant la connexion que l'accès est réservé et journalisé. Elle n'arrête pas une attaque, mais facilite d'éventuelles poursuites (l'intrus ne peut pas prétendre l'ignorer).
- **fail2ban** : déclare explicitement une valeur par défaut, pour supprimer un avertissement à chaque lancement.

### Permissions
La crontab, les dossiers `/etc/cron.*` et la configuration SSH étaient lisibles par tous les comptes. Ils révèlent les tâches planifiées et les réglages SSH à un compte non privilégié compromis. Ils sont réservés à root, comme le recommande le CIS. Les permissions sont fixées avec `dpkg-statoverride`, que dpkg respecte lors des mises à jour : une nouvelle version du paquet `cron` ne les remet pas à l'ancienne valeur (vérifié).

### Les écarts acceptés par Lynis
[`lynis-custom.prf`](lynis-custom.prf) déclare à Lynis **uniquement** ses faux positifs et ses exigences incompatibles avec Docker :

| Test | Pourquoi |
|---|---|
| `NETW-3200` | Les modules sont bloqués par `install … /bin/false` (forme recommandée par le CIS), alors que Lynis 3.0.9 n'accepte que `/bin/true`. Contrôle manuel : `modprobe -n -v dccp` |
| `KRNL-6000:kernel.perf_event_paranoid` | Ubuntu le règle à 4, plus strict que le 3 attendu |
| `KRNL-6000:kernel.modules_disabled` | Docker charge des modules à la demande : tout interdire casserait les déploiements |
| `KRNL-6000:net.ipv4.conf.all.forwarding` | Docker fait passer le trafic vers les conteneurs |

Les suggestions écartées **par choix** (tableau suivant) restent visibles dans le rapport : l'indice de Lynis doit refléter l'état réel, pas être embelli.

### Les suggestions de Lynis écartées
| Suggestion | Pourquoi |
|---|---|
| Changer le port SSH | Sécurité par l'obscurité (voir plus haut) |
| Expiration et complexité des mots de passe | Connexion par clé uniquement ; le seul mot de passe (sudo) n'a pas à expirer, ce que le NIST déconseille |
| Partitions séparées, mot de passe GRUB | Inadaptés à un VPS. La console est protégée par le compte IONOS : double authentification indispensable |
| `umask 027`, `libpam-tmpdir`, `apt-listbugs`, `apt-listchanges`, `apt-show-versions` | Peu de gain sur un serveur à un seul administrateur, sans session interactive d'installation |
| `jail.local` pour fail2ban | La configuration est déjà dans `jail.d/sshd.local`, la méthode recommandée |
| Comptabilité des processus, sysstat | Le journal d'audit trace déjà les commandes ; les mesures de performance viendront avec la supervision |
| Journaux hors du serveur, contrôle d'intégrité (AIDE), détecteur de logiciels malveillants (rkhunter) | **Prévus avec la supervision** (`v0.6`) : utiles, mais demandent un service extérieur ou un suivi des alertes (rkhunter est connu pour ses faux positifs) |
| Durcir les services systemd | À faire pour `miam-backup.service` (le seul service écrit pour le projet) |

## Installation, un chantier à la fois

Depuis le poste, à la racine du dépôt :

```bash
scp deploy/hardening/{52unattended-upgrades-miam,99-miam-hardening.conf,miam-modules.conf,90-miam-nocore.conf,00-hardening.conf,miam.rules,issue,fail2ban-miam.local,lynis-custom.prf} miam-vps:/tmp/
ssh -t miam-vps
```

**Garder cette session SSH ouverte** pendant toute l'installation, et tester chaque changement dans **une deuxième** session : en cas de problème, la première permet de revenir en arrière.

### 0. Mesure de départ (Lynis)

```bash
sudo apt install -y lynis
sudo lynis audit system --quick > /dev/null
sudo grep -E '^(hardening_index|warning\[\]|suggestion\[\])' /var/log/lynis-report.dat
```

Le paquet installe aussi `lynis.timer`, un audit quotidien dont le rapport est dans `/var/log/lynis-report.dat`.

### 1. Redémarrage automatique

```bash
sudo install -o root -g root -m 644 /tmp/52unattended-upgrades-miam /etc/apt/apt.conf.d/
apt-config dump | grep -E 'Automatic-Reboot|Remove-Unused-Kernel'      # 4 lignes, Reboot "true", Time "03:30"
```

### 2. Noyau

```bash
# Apport d'abord : en s'arrêtant, il réécrit le réglage des vidages mémoire.
sudo sed -i 's/^enabled=1/enabled=0/' /etc/default/apport
sudo systemctl disable --now apport.service apport-autoreport.path apport-autoreport.timer apport-forward.socket

sudo install -o root -g root -m 644 /tmp/miam-modules.conf /etc/modprobe.d/
sudo install -o root -g root -m 644 /tmp/90-miam-nocore.conf /etc/security/limits.d/
sudo install -o root -g root -m 644 /tmp/99-miam-hardening.conf /etc/sysctl.d/
sudo sysctl -p /etc/sysctl.d/99-miam-hardening.conf                    # affiche chaque valeur appliquée
lsmod | grep -E '^(dccp|sctp|rds|tipc|usb_storage) ' || echo "aucun module interdit chargé"
```

Vérifier tout de suite, dans une **nouvelle** session SSH et depuis le poste :

```bash
ssh miam-vps true && echo "SSH ok"
curl -s https://api.miam-alert.fr/health                                 # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://miam-alert.fr           # 200
ssh -t miam-vps 'sudo docker exec miam-alert-prod-api-1 wget -q -O /dev/null https://world.openfoodfacts.org && echo "sortie Internet des conteneurs ok"'
```

### 3. SSH

```bash
sudo install -o root -g root -m 644 /tmp/00-hardening.conf /etc/ssh/sshd_config.d/00-hardening.conf
sudo sshd -t && sudo systemctl reload ssh                                # sshd -t : rien n'est appliqué si la config est invalide
sudo sshd -T | grep -E '^(allowtcpforwarding|disableforwarding|loglevel|maxsessions|tcpkeepalive|passwordauthentication) '
```

Puis, **sans fermer la session en cours**, depuis le poste : `ssh miam-vps true && echo "SSH ok"`. La connexion apparaît ensuite avec l'empreinte de la clé : `sudo journalctl -u ssh --since -5min | grep 'Accepted publickey'`.

### 4. Journal d'audit

```bash
sudo apt install -y auditd
sudo install -d -o root -g root -m 700 /root/.ssh                        # surveillé : doit exister
sudo install -o root -g root -m 640 /tmp/miam.rules /etc/audit/rules.d/50-miam.rules
sudo sed -i -E 's/^max_log_file = .*/max_log_file = 50/; s/^num_logs = .*/num_logs = 10/' /etc/audit/auditd.conf
sudo systemctl restart auditd                                            # relit la configuration et charge les règles
sudo auditctl -l | wc -l                                                 # 26
sudo auditctl -s | grep -E '^(enabled|lost)'                             # enabled 1, lost 0
```

Si une règle est refusée, `sudo augenrules --load` indique la ligne. Essai :

```bash
sudo ls /etc/sudoers.d > /dev/null
sudo ausearch -k root_commands -ts recent -i | tail -4                   # la commande ls, avec auid=kabo
```

### 5. Bannière et fail2ban

```bash
sudo install -o root -g root -m 644 /tmp/issue /etc/issue
sudo install -o root -g root -m 644 /tmp/issue /etc/issue.net
sudo install -o root -g root -m 644 /tmp/fail2ban-miam.local /etc/fail2ban/fail2ban.d/miam.local
sudo fail2ban-client -t && sudo systemctl restart fail2ban
sudo fail2ban-client status sshd | tail -3                               # la prison SSH est toujours active
```

### 6. Permissions et profil Lynis

```bash
sudo dpkg-statoverride --update --add root root 0600 /etc/crontab
sudo dpkg-statoverride --update --add root root 0600 /etc/ssh/sshd_config
for d in /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.weekly /etc/cron.monthly; do
  sudo dpkg-statoverride --update --add root root 0700 "$d"
done
sudo dpkg-statoverride --list                                            # les 7 permissions fixées
sudo install -o root -g root -m 644 /tmp/lynis-custom.prf /etc/lynis/custom.prf
```

### 7. Mesure finale et nettoyage

```bash
sudo lynis audit system --quick > /dev/null
sudo grep -E '^(hardening_index|warning\[\]|suggestion\[\])' /var/log/lynis-report.dat
sudo grep 'different value than expected' /var/log/lynis.log                 # réglages du noyau encore différents
rm /tmp/{52unattended-upgrades-miam,99-miam-hardening.conf,miam-modules.conf,90-miam-nocore.conf,00-hardening.conf,miam.rules,issue,fail2ban-miam.local,lynis-custom.prf}
```

## Vérifier que tout fonctionne

On teste l'**effet** de chaque réglage, pas seulement sa présence.

**Depuis le poste :**

```bash
curl -s https://api.miam-alert.fr/health                        # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://miam-alert.fr   # 200
ssh -W 127.0.0.1:22 miam-vps </dev/null                         # « administratively prohibited » : tunnels refusés
ssh -A miam-vps 'echo "[$SSH_AUTH_SOCK]"'                        # [] : agent SSH non transmis
ssh -o PubkeyAuthentication=no miam-vps                          # « Permission denied (publickey) » : pas de mot de passe
```

Le dernier test compte comme un échec pour fail2ban : ne pas le répéter plus de deux ou trois fois de suite. Dans le navigateur : se connecter et scanner un produit (l'API doit toujours joindre Open Food Facts).

**Sur le serveur :**

```bash
# Noyau
sudo modprobe dccp; echo "code $?"                    # erreur « could not insert 'dccp' », code 1 : module bloqué
sudo head -2 /proc/kallsyms                           # adresses à 0000000000000000, même pour root
bash -c 'ulimit -Hc'                                  # 0 : aucun vidage mémoire

# SSH : la connexion, avec l'empreinte de la clé (à comparer à : ssh-keygen -lf ~/.ssh/miam-alert-vps.pub, sur le poste)
sudo journalctl -u ssh --since -10min | grep 'Accepted publickey' | tail -2

# Journal d'audit : une modification et une lecture de secret, puis leur trace
sudo touch /etc/ssh/sshd_config.d/00-hardening.conf
sudo wc -c ~/miam-alert/.env.prod                     # lit le fichier, n'affiche que sa taille
sudo ausearch -k sshd_config -ts recent -i | grep '^type=SYSCALL' | tail -1    # comm=touch, auid=kabo
sudo ausearch -k app_secrets -ts recent -i | grep '^type=SYSCALL' | tail -1    # comm=wc, auid=kabo

# Permissions
ls -ld /etc/crontab /etc/cron.d /etc/ssh/sshd_config  # -rw------- et drwx------
cat /etc/crontab                                      # « Permission denied » sans sudo

# fail2ban
sudo fail2ban-client status sshd
```

**Le redémarrage**, test final : il vérifie que tout se réapplique au démarrage (réglages du noyau, règles d'audit) et que l'application repart seule, comme lors d'un redémarrage automatique de nuit. Une à deux minutes d'interruption.

```bash
sudo reboot
```

Puis, depuis le poste, après deux minutes :

```bash
curl -s https://api.miam-alert.fr/health
ssh -t miam-vps 'uptime -p; sysctl kernel.kexec_load_disabled net.ipv4.conf.default.accept_source_route kernel.core_pattern; sudo auditctl -l | wc -l; cd ~/miam-alert && sudo docker compose -f docker-compose.prod.yml --env-file .env.prod ps -a --format "{{.Service}}: {{.Status}}"'
```

Attendu : `{"status":"ok"}` ; `1`, `0`, `|/bin/false` ; `26` règles ; `db`, `api`, `web`, `proxy` en `healthy`. `migrate` reste `Exited (0)` : il ne tourne qu'au déploiement.

## Revenir en arrière

| Chantier | Commande |
|---|---|
| Redémarrage automatique | `sudo rm /etc/apt/apt.conf.d/52unattended-upgrades-miam` |
| Noyau | `sudo rm /etc/sysctl.d/99-miam-hardening.conf /etc/modprobe.d/miam-modules.conf /etc/security/limits.d/90-miam-nocore.conf`, puis **redémarrer** : certains réglages (`kexec_load_disabled`, et ceux qu'Ubuntu ne fixe pas) gardent leur valeur jusque-là. Apport : `enabled=1` dans `/etc/default/apport`, puis `sudo systemctl enable --now apport.service` |
| SSH | Depuis la session restée ouverte : réinstaller la version précédente du fichier (historique Git), puis `sudo sshd -t && sudo systemctl reload ssh` |
| Journal d'audit | `sudo rm /etc/audit/rules.d/50-miam.rules && sudo systemctl restart auditd` (ou `sudo apt remove auditd`) |
| Bannière, fail2ban | `sudo rm /etc/fail2ban/fail2ban.d/miam.local && sudo systemctl restart fail2ban` ; `/etc/issue` : `sudo apt install --reinstall base-files` |
| Permissions | Pour chaque chemin : `sudo dpkg-statoverride --remove <chemin>`, puis `sudo chmod 644` (fichiers) ou `755` (dossiers) |
| Profil Lynis | `sudo rm /etc/lynis/custom.prf` |

## Commandes

**(serveur)**

```bash
# Redémarrage
ls /var/run/reboot-required 2>/dev/null && cat /var/run/reboot-required.pkgs     # un redémarrage est-il en attente ?
last -x reboot | head -5                                                         # derniers redémarrages
sudo grep -i reboot /var/log/unattended-upgrades/unattended-upgrades.log | tail -5

# Noyau
sysctl net.ipv4.conf.all.rp_filter kernel.kptr_restrict kernel.yama.ptrace_scope kernel.core_pattern
/usr/sbin/modprobe -n -v dccp                                                    # « install /bin/false » : module bloqué
sudo journalctl -k --since today | grep -i martian | tail                        # paquets aux adresses impossibles

# SSH : connexions du jour, avec l'empreinte de la clé
sudo journalctl -u ssh --since today | grep -E 'Accepted publickey|Failed|Invalid user' | tail -20
sudo fail2ban-client status sshd                                                 # adresses bannies

# Journal d'audit
sudo aureport --summary                                                          # vue d'ensemble
sudo ausearch -k root_commands -ts today -i | grep -E '^type=EXECVE' | tail -20  # commandes root du jour
for k in identity sudoers ssh_keys sshd_config; do sudo ausearch -k $k -ts week-ago -i; done   # comptes, sudo, SSH : une semaine
sudo ausearch -k app_secrets -ts today -i | grep -E 'auid=|name=' | tail        # accès aux secrets
sudo aureport -l --failed -ts week-ago                                           # connexions échouées
sudo auditctl -s                                                                 # état (enabled, lost, backlog)

# Lynis (un audit tourne aussi chaque jour : lynis.timer)
sudo lynis audit system --quick > /dev/null && sudo grep '^hardening_index' /var/log/lynis-report.dat
sudo grep -E '^(warning|suggestion)\[\]' /var/log/lynis-report.dat                # ce qu'il reste à examiner
sudo dpkg-statoverride --list                                                    # permissions fixées
```

## À savoir

- Le journal d'audit part toutes les 15 minutes, chiffré, vers une archive non modifiable hors du serveur ([deploy/logship/](../logship/README.md)) : un intrus devenu root ne peut plus effacer ses traces déjà envoyées. Suite possible : rendre les règles **immuables** (`-e 2` : plus modifiables sans redémarrer), une fois vérifié pendant quelques semaines qu'elles ne sont pas trop bruyantes.
- Une alerte UptimeRobot pendant la nuit peut simplement correspondre à un redémarrage automatique : vérifier avec `last -x reboot`.
- Les commandes Docker lancées par `miam-deploy` apparaissent dans `root_commands` avec `auid=deploy` : c'est la trace des déploiements.
- `00-hardening.conf` contient `AllowUsers kabo deploy` : l'étape 4 de [deploy/server/README.md](../server/README.md) (ajout de `deploy`) n'est utile que sur un serveur qui n'a pas encore ce fichier.
