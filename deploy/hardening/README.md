# Durcissement du serveur

Réglages du système du serveur de production (VPS IONOS, Ubuntu 24.04), en plus de ce qui était déjà en place :
- connexion SSH par clé uniquement, root interdit ;
- pare-feu `ufw` (22, 80, 443) et `fail2ban` ;
- mises à jour de sécurité automatiques ;
- conteneurs non-root, en lecture seule, sans capacités.

Le but est de **réduire ce qu'un attaquant peut faire** sur le serveur, et de **garder une trace** de ce qui s'y passe.

| Chantier | Fichier | Installé dans |
|---|---|---|
| Redémarrage automatique après une mise à jour du noyau | [`52unattended-upgrades-miam`](52unattended-upgrades-miam) | `/etc/apt/apt.conf.d/` |
| Réglages du noyau | [`99-miam-hardening.conf`](99-miam-hardening.conf) | `/etc/sysctl.d/` |
| Journal d'audit (auditd) | [`miam.rules`](miam.rules) | `/etc/audit/rules.d/50-miam.rules` |
| Mesure (Lynis) | aucun | paquet `lynis` |

## Les choix

### Redémarrage automatique
Les mises à jour automatiques installent chaque jour les correctifs du noyau et des bibliothèques de base, mais ceux-ci **ne s'appliquent qu'au redémarrage**. Sans lui, le serveur peut tourner des semaines avec un noyau vulnérable déjà corrigé sur le disque.

- Redémarrage **seulement quand il est nécessaire** (fichier `/var/run/reboot-required`).
- À **03:30 UTC** (le serveur est en UTC), soit 4 h 30 à Paris en hiver et 5 h 30 en été. C'est toujours après la sauvegarde (3 h à Paris) et la purge de l'API (4 h à Paris).
- Une à deux minutes d'interruption : Docker démarre avec le système, et les conteneurs repartent seuls (`restart: unless-stopped`). La base vérifie son état avant que l'API démarre.
- Un correctif installé vers 6 h UTC attend le redémarrage de la nuit suivante.

### Réglages du noyau
Ubuntu durcit déjà beaucoup de choses (BPF non privilégié désactivé, protection des liens, ASLR…). Le fichier ne change que ce qui reste ; chaque ligne y est commentée. Les principaux :
- **réseau** : filtrage strict de l'adresse source (paquets usurpés rejetés), aucune redirection ICMP envoyée ni acceptée, paquets aux adresses impossibles journalisés ;
- **noyau** : adresses mémoire masquées à tous, seul un administrateur peut lire la mémoire d'un autre processus (`ptrace`), compilateur BPF durci, pas de remplacement du noyau à chaud (`kexec`), touches « magiques » désactivées ;
- **fichiers** : pas de vidage mémoire des programmes setuid, tubes nommés protégés dans `/tmp`.

⚠️ `net.ipv4.ip_forward` reste à 1 : Docker en a besoin pour faire passer le trafic vers les conteneurs. C'est pourquoi le fichier n'y touche pas.

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

### Lynis
Outil d'audit qui examine le système **sans rien modifier**. Il donne un indice de durcissement sur 100 et une liste de suggestions. On le lance avant les changements, pour avoir un point de départ, et après, pour mesurer le gain. Ses suggestions disent aussi ce qu'il reste d'utile à faire. Paquet des dépôts Ubuntu : signé, et mis à jour par le système.

## Installation, un chantier à la fois

Depuis le poste, à la racine du dépôt :

```bash
scp deploy/hardening/52unattended-upgrades-miam deploy/hardening/99-miam-hardening.conf deploy/hardening/miam.rules miam-vps:/tmp/
ssh -t miam-vps
```

**Garder cette session SSH ouverte** pendant toute l'installation, et tester chaque changement dans **une deuxième** session : en cas de problème, la première permet de revenir en arrière.

### 0. Mesure de départ (Lynis)

```bash
sudo apt install -y lynis
sudo lynis audit system --quick > /dev/null
sudo grep -E '^(hardening_index|warning\[\]|suggestion\[\])' /var/log/lynis-report.dat
```

Noter l'indice (`hardening_index`) et garder la liste.

### 1. Redémarrage automatique

```bash
sudo install -o root -g root -m 644 /tmp/52unattended-upgrades-miam /etc/apt/apt.conf.d/
apt-config dump | grep -E 'Automatic-Reboot|Remove-Unused-Kernel'      # 4 lignes, Reboot "true", Time "03:30"
```

### 2. Réglages du noyau

```bash
sudo install -o root -g root -m 644 /tmp/99-miam-hardening.conf /etc/sysctl.d/
sudo sysctl -p /etc/sysctl.d/99-miam-hardening.conf                    # affiche chaque valeur appliquée
```

Vérifier tout de suite, dans une **nouvelle** session SSH et depuis le poste :

```bash
ssh miam-vps true && echo "SSH ok"
curl -s https://api.miam-alert.fr/health                                 # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://miam-alert.fr           # 200
ssh -t miam-vps 'sudo docker exec miam-alert-prod-api-1 wget -q -O /dev/null https://world.openfoodfacts.org && echo "sortie Internet des conteneurs ok"'
```

### 3. Journal d'audit

```bash
sudo apt install -y auditd
sudo install -d -o root -g root -m 700 /root/.ssh                        # surveillé : doit exister
sudo install -o root -g root -m 640 /tmp/miam.rules /etc/audit/rules.d/50-miam.rules
sudo sed -i -E 's/^max_log_file = .*/max_log_file = 50/; s/^num_logs = .*/num_logs = 10/' /etc/audit/auditd.conf
sudo systemctl restart auditd                                            # relit la configuration et charge les règles
sudo auditctl -l | wc -l                                                 # 26
sudo auditctl -s | grep -E '^(enabled|lost)'                             # enabled 1, lost 0
```

Si une règle est refusée, `augenrules` indique la ligne : `sudo augenrules --load`.

Essai :

```bash
sudo ls /etc/sudoers.d > /dev/null
sudo ausearch -k root_commands -ts recent -i | tail -4                   # la commande ls, avec auid=kabo
```

### 4. Mesure finale et nettoyage

```bash
sudo lynis audit system --quick > /dev/null
sudo grep -E '^(hardening_index|warning\[\]|suggestion\[\])' /var/log/lynis-report.dat
rm /tmp/52unattended-upgrades-miam /tmp/99-miam-hardening.conf /tmp/miam.rules
```

## Revenir en arrière

| Chantier | Commande |
|---|---|
| Redémarrage automatique | `sudo rm /etc/apt/apt.conf.d/52unattended-upgrades-miam` |
| Réglages du noyau | `sudo rm /etc/sysctl.d/99-miam-hardening.conf && sudo sysctl --system`, puis **redémarrer** : certains réglages (`kexec_load_disabled`, et ceux qu'Ubuntu ne fixe pas) gardent leur valeur jusqu'au redémarrage |
| Journal d'audit | `sudo rm /etc/audit/rules.d/50-miam.rules && sudo systemctl restart auditd` (ou `sudo apt remove auditd`) |

## Commandes

**(serveur)**

```bash
# Redémarrage
ls /var/run/reboot-required 2>/dev/null && cat /var/run/reboot-required.pkgs     # un redémarrage est-il en attente ?
last -x reboot | head -5                                                         # derniers redémarrages
sudo grep -i reboot /var/log/unattended-upgrades/unattended-upgrades.log | tail -5

# Réglages du noyau
sysctl net.ipv4.conf.all.rp_filter kernel.kptr_restrict kernel.yama.ptrace_scope
sudo journalctl -k --since today | grep -i martian | tail                        # paquets aux adresses impossibles

# Journal d'audit
sudo aureport --summary                                                          # vue d'ensemble
sudo ausearch -k root_commands -ts today -i | grep -E '^type=EXECVE' | tail -20  # commandes root du jour
for k in identity sudoers ssh_keys sshd_config; do sudo ausearch -k $k -ts week-ago -i; done   # comptes, sudo, SSH : une semaine
sudo ausearch -k app_secrets -ts today -i | grep -E 'auid=|name=' | tail        # accès aux secrets
sudo aureport -l --failed -ts week-ago                                           # connexions échouées
sudo auditctl -s                                                                 # état (enabled, lost, backlog)

# Lynis
sudo lynis audit system --quick > /dev/null && sudo grep '^hardening_index' /var/log/lynis-report.dat
```

## À savoir

- **Limite** : un intrus devenu root pourrait effacer le journal d'audit, qui reste sur le serveur. Deux suites possibles : l'envoyer hors du serveur (supervision, `v0.6`), et rendre les règles **immuables** (`-e 2` : plus modifiables sans redémarrer), une fois vérifié pendant quelques semaines qu'elles ne sont pas trop bruyantes.
- Une alerte UptimeRobot pendant la nuit peut simplement correspondre à un redémarrage automatique : vérifier avec `last -x reboot`.
- Les commandes Docker lancées par `miam-deploy` apparaissent dans `root_commands` avec `auid=deploy` : c'est la trace des déploiements.
