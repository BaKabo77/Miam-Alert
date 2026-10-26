# Évolutions possibles

Catalogue de tout ce qui pourrait être ajouté à Miam'Alert à terme : fonctionnalités, sécurité, exploitation, qualité. Ce n'est pas un engagement : c'est la réserve dans laquelle la [feuille de route](../README.md#feuille-de-route) vient piocher.

**Effort** : S = moins d'une journée, M = quelques jours, L = une semaine ou plus.
**Priorité** : 🔴 à faire vite (risque réel maintenant que l'application est en ligne), 🟠 prochaines versions, 🟢 un jour.

---

## Priorités recommandées

Dans l'ordre, maintenant que de vrais utilisateurs peuvent créer un compte :

1. 🔴 **Sauvegardes de la base de données** : aujourd'hui, une panne de disque ou une fausse manipulation ferait tout perdre.
2. 🔴 **Mentions légales et politique de confidentialité** : obligatoires en France pour un site public qui collecte des emails (LCEN, RGPD art. 13).
3. 🔴 **Mot de passe oublié, suppression du compte, export des données** : un utilisateur doit pouvoir récupérer son accès et exercer ses droits RGPD sans écrire au développeur.
4. 🟠 **Déploiement continu** avec analyse des images (Trivy).
5. 🟠 **Supervision** : être prévenu quand le site tombe, avant les utilisateurs.
6. 🟠 **Recettes V1**, la fonctionnalité qui donne tout son sens à l'application.

---

## 1. Fonctionnalités

### Inventaire

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Emplacements de stockage (frigo, congélateur, placard) | Prévu dans le modèle de données ; filtrer « ce qui est au frigo » | M | 🟠 | Table `StorageLocation` rattachée au foyer : même contrôle d'appartenance que les articles (tests IDOR). |
| Date suggérée selon la catégorie | Accélère l'ajout (yaourt : +3 sem., viande : +3 j) | S | 🟠 | Table de durées côté serveur, jamais fournie par le client. |
| Consommation partielle (« la moitié du paquet ») | Quantités réalistes | S | 🟢 | Quantité restante bornée (≥ 0, ≤ quantité initiale). |
| Passage au congélateur avec nouvelle date | Le statut `FROZEN` existe ; recalculer la date (+3 mois) | S | 🟢 | |
| Recherche et filtres (nom, statut, emplacement) | Inventaires de plus de 30 articles | S | 🟢 | Recherche paramétrée (Prisma `contains`), longueur bornée. |
| Ajout en lot (plusieurs scans d'affilée) | Retour de courses plus rapide | M | 🟢 | Taille du lot plafonnée (déni de service). |
| Historique d'un article (ajouté, consommé, jeté) | Base des statistiques | M | 🟢 | Table `ConsumptionEvent` prévue au modèle. |

### Recettes

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Recettes V1 : base locale + score par urgence | Fonctionnalité centrale du projet | L | 🟠 | Interface `RecipeProvider` (local / IA) prévue ; tests unitaires du score. |
| Recettes V2 : suggestions par IA (Mistral ou Gemini) | Recettes illimitées, adaptées au contenu exact | L | 🟢 | Clé d'API côté serveur, quotas par utilisateur, sortie validée par un schéma, noms de produits traités comme données (injection de prompt). |
| Filtres régime (végétarien, sans gluten…) | Utilité réelle | M | 🟢 | Donnée de préférence : minimisation, effaçable. |
| Planning des repas de la semaine | Prolonge les recettes | L | 🟢 | |

### Foyer partagé (V2)

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Invitation d'un membre par lien | Le foyer existe déjà dans le modèle | M | 🟢 | Jeton d'invitation aléatoire, haché en base, à usage unique, expirant (48 h). |
| Rôles `OWNER` / `MEMBER` | Seul le propriétaire invite, exclut, supprime le foyer | M | 🟢 | Guard dédié + tests d'escalade de privilèges (un membre tente une action de propriétaire). |
| Quitter un foyer, transférer la propriété | Cycle de vie complet | S | 🟢 | Un foyer ne doit jamais rester sans propriétaire. |
| Liste de courses partagée | Usage quotidien d'un foyer | M | 🟢 | Mêmes contrôles d'appartenance. |

### Alertes et notifications

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Notifications push (Web Push) | L'alerte arrive sans ouvrir l'application | M | 🟠 | Clés VAPID en secret serveur ; abonnement rattaché à l'utilisateur, supprimé à la déconnexion ; contenu minimal (pas de nom de produit sur l'écran verrouillé). |
| Heure d'alerte choisie par l'utilisateur | Confort | S | 🟢 | Valeur bornée (liste d'heures). |
| Email récapitulatif hebdomadaire (facultatif) | Pour ceux qui n'installent pas l'application | M | 🟢 | Consentement explicite, lien de désinscription, SPF/DKIM/DMARC. |
| Fuseau horaire du foyer | « Aujourd'hui » juste hors de France (limite connue) | S | 🟢 | Liste fermée des fuseaux IANA. |

### Saisie assistée

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Lecture de la date par OCR | La date est l'étape la plus lente de l'ajout | L | 🟢 | Traitement sur l'appareil (Tesseract.js) plutôt qu'un service tiers : la photo ne quitte pas le téléphone. |
| Import d'un ticket de caisse | Ajout de toutes les courses d'un coup | L | 🟢 | Fichier téléversé = entrée hostile : taille, type réel, traitement isolé. |
| Allergènes et Nutri-Score affichés | Données déjà fournies par Open Food Facts | S | 🟢 | Mêmes règles de nettoyage que les autres champs. |

### Statistiques et anti-gaspi

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Statistiques de gaspillage (jeté / consommé par mois) | Mesurer les progrès, motivation | M | 🟢 | Agrégats par foyer uniquement. |
| Estimation des économies réalisées | Argument concret | M | 🟢 | |
| Mode don (proposer un produit à des proches ou une association) | Prolonge la mission anti-gaspi | L | 🟢 | Ne publier que ce que l'utilisateur choisit ; aucune localisation précise. |

### Confort et accessibilité

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Thème sombre | Confort, usage le soir | S | 🟢 | Contrastes WCAG AA à revérifier. |
| Police mise en cache hors ligne (`woff2`) | Affichage identique hors ligne | S | 🟠 | |
| Audit d'accessibilité complet (lecteur d'écran, RGAA) | Inclusion, qualité perçue | M | 🟢 | |
| Traduction (anglais) | Portfolio lisible à l'international | M | 🟢 | |

---

## 2. Compte et données personnelles (RGPD)

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| Mentions légales | Obligation légale (LCEN) : éditeur, hébergeur | S | 🔴 | |
| Politique de confidentialité | Obligation RGPD : données, finalités, durées, droits | S | 🔴 | Le seul cookie (session) est strictement nécessaire : pas de bandeau de consentement requis, à expliquer dans la politique. |
| Mot de passe oublié | Sinon, un oubli = compte perdu | M | 🔴 | Jeton aléatoire, haché, à usage unique, expirant (30 min) ; réponse identique que l'email existe ou non ; toutes les sessions révoquées après changement. |
| Suppression du compte | Droit à l'effacement (art. 17) | M | 🔴 | Ré-authentification avant suppression ; suppression réelle en cascade (foyer, articles, sessions, alertes). |
| Export des données | Droit à la portabilité (art. 20) | S | 🔴 | Export JSON des seules données de l'utilisateur ; rate limit. |
| Changement de mot de passe | Hygiène de base | S | 🟠 | Ancien mot de passe exigé ; autres sessions révoquées. |
| Vérification de l'email | Supprime la limite connue du `409` à l'inscription | M | 🟠 | Jeton à usage unique ; service d'envoi d'emails à choisir (Brevo, hébergé dans l'UE). |
| Changement d'email | Cycle de vie complet | M | 🟢 | Confirmation sur l'ancienne et la nouvelle adresse. |
| Liste des sessions actives et déconnexion à distance | Réagir à un appareil perdu | M | 🟠 | Les familles de refresh tokens existent déjà en base. |
| Double authentification (TOTP ou passkeys) | Protection contre le vol de mot de passe | L | 🟢 | Passkeys (WebAuthn) : résistantes à l'hameçonnage ; codes de secours hachés. |
| Vérification des mots de passe compromis (Have I Been Pwned) | Refuser « motdepasse123456 » | S | 🟠 | Méthode k-anonymity : seuls 5 caractères du hash SHA-1 quittent le serveur. |
| Purge des comptes inactifs | Durée de conservation limitée (RGPD) | S | 🟢 | Email de prévenance avant suppression. |
| Registre des traitements | Documentation RGPD attendue en entreprise | S | 🟢 | Fichier dans `docs/`. |

---

## 3. Sécurité applicative

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Durée de vie maximale d'une session | Aujourd'hui une session peut se prolonger indéfiniment par rotation | S | 🟠 | Expiration absolue de la famille de tokens (ex. 30 jours). |
| Verrouillage progressif par compte | Le rate limit est par IP ; un attaquant distribué contourne | M | 🟠 | Délai croissant après échecs sur un même compte, sans bloquer le vrai propriétaire (pas de verrouillage dur). |
| Rapport des violations de CSP (`report-to`) | Détecter une tentative d'injection ou un oubli de configuration | S | 🟢 | Point de collecte limité en taille et en débit. |
| `security.txt` (RFC 9116) | Indique aux chercheurs comment signaler une faille | S | 🟢 | `/.well-known/security.txt`, avec une date d'expiration. |
| Table d'audit (qui a fait quoi, quand) | Traçabilité attendue en environnement normé | M | 🟢 | Ajout seul (jamais modifiée), sans donnée personnelle superflue. |
| Modèle de menaces documenté (STRIDE) | Montre la démarche, pas seulement le résultat | M | 🟠 | `docs/threat-model.md` avec schéma des flux. |
| Correspondance OWASP ASVS niveau 2 | Référentiel de vérification reconnu | M | 🟢 | Tableau exigence → preuve (test, code). |
| Tests de mutation sur la logique de sécurité (Stryker) | Prouver que les tests détectent vraiment les régressions | M | 🟢 | Fait à la main pour `TRUST_PROXY` ; à généraliser. |
| Fuzzing des DTO | Entrées inattendues (Unicode, tailles, types) | M | 🟢 | |
| Test d'intrusion avec OWASP ZAP | Analyse dynamique de l'application en marche | M | 🟠 | Job CI sur un environnement de test, jamais sur la production. |

---

## 4. Infrastructure et exploitation

### Sauvegardes et reprise

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Sauvegarde quotidienne de PostgreSQL | Aucune sauvegarde aujourd'hui | S | 🔴 | `pg_dump` planifié, **chiffré** (age ou GPG) avant de quitter le serveur. |
| Copie hors du serveur | Un serveur perdu ne doit pas emporter ses sauvegardes | S | 🔴 | Stockage objet dans l'UE ; identifiants en écriture seule (un serveur compromis ne peut pas effacer les sauvegardes). |
| Test de restauration régulier | Une sauvegarde jamais restaurée n'est pas une sauvegarde | S | 🔴 | Restauration automatique dans une base jetable, chaque mois. |
| Plan de reprise documenté | Savoir remonter le service en une heure | S | 🟠 | Procédure pas à pas dans `docs/`. |

### Déploiement

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Déploiement continu (étape 11 bis) | Plus de construction sur le serveur | M | 🟠 | Images analysées par Trivy ; clé SSH limitée à une commande ; jeton du registre en lecture seule. |
| Retour arrière en une commande | Annuler une version défectueuse | S | 🟠 | Images taguées par version : redéployer la précédente. |
| Signature des images (cosign) et SBOM | Garantir que l'image déployée est celle construite par la CI | M | 🟢 | Vérification de la signature avant déploiement. |
| Environnement de préproduction | Tester une version avant la production | M | 🟢 | Sous-domaine dédié, données factices, protégé. |
| Déploiement sans coupure | Pas d'interruption de quelques secondes | M | 🟢 | |
| Serveur décrit en code (Ansible) | Reconstruire le serveur à l'identique | M | 🟢 | Durcissement reproductible et relisible. |

### Supervision

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Surveillance de disponibilité externe | Être prévenu quand le site tombe | S | 🟠 | Service externe gratuit ou Uptime Kuma ; alerte si certificat bientôt expiré. |
| Vérification que la tâche des alertes a tourné | Une tâche planifiée peut échouer en silence | S | 🟠 | Signal envoyé après chaque exécution (healthchecks.io). |
| Logs entièrement en JSON | Exploitables par un outil (aujourd'hui avec codes couleur) | S | 🟠 | Logger NestJS JSON en production. |
| Centralisation des logs et alertes de sécurité | Repérer une attaque (rafale d'échecs, vol de session) | M | 🟢 | Loki + Grafana, ou alertes simples sur les événements `auth.*`. |
| Métriques (temps de réponse, erreurs) | Voir les dégradations | M | 🟢 | Prometheus + Grafana, non exposés publiquement. |
| Limites de ressources par conteneur | Un conteneur emballé ne fait pas tomber les autres | S | 🟠 | Mémoire et CPU dans `docker-compose.prod.yml`. |

### Durcissement complémentaire

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Secrets Docker (fichiers) au lieu de variables d'environnement | Limite connue documentée | M | 🟢 | Lecture des secrets depuis `/run/secrets`. |
| Audit du serveur avec Lynis (référentiel CIS) | Mesurer le durcissement, score à améliorer | S | 🟠 | |
| Redémarrage automatique pour les mises à jour du noyau | Les correctifs du noyau ne s'appliquent qu'au redémarrage | S | 🟠 | Fenêtre nocturne, avec la supervision pour vérifier le retour. |
| Docker en mode rootless | Un conteneur évadé n'obtiendrait pas root sur l'hôte | M | 🟢 | |
| CrowdSec en complément de fail2ban | Blocage collaboratif des IP malveillantes | S | 🟢 | |
| DNSSEC | Empêche la falsification des réponses DNS | S | 🟢 | À activer chez IONOS si disponible pour `.fr`. |
| Enregistrements email « domaine qui n'envoie pas » | Empêche l'usurpation de `@miam-alert.fr` tant qu'aucun email n'est envoyé | S | 🟠 | SPF `-all`, DMARC `p=reject` ; à revoir le jour où l'application enverra des emails. |
| HSTS preload | HTTPS imposé dès la toute première visite | S | 🟢 | Difficile à annuler : seulement une fois tous les sous-domaines en HTTPS durablement. |

---

## 5. Qualité et outillage

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Renovate | Mises à jour des dépendances proposées automatiquement | S | 🟠 | Prévu dans le CLAUDE.md, pas encore en place. |
| Tests du front (Vitest + Testing Library) | Le front n'a pas de tests automatisés | M | 🟠 | En priorité : client HTTP (refresh unique), session. |
| Tests de bout en bout du parcours dans la CI (Playwright) | Le parcours vérifié à la main deviendrait automatique | M | 🟠 | Caméra simulée, comme lors des vérifications manuelles. |
| Seuil de couverture de tests en CI | Empêcher la couverture de baisser | S | 🟢 | Seuil élevé sur `auth`, `pantry`, `households`. |
| Documentation OpenAPI (Swagger) | API explorable, utile aux recruteurs | S | 🟢 | Activée en développement uniquement, jamais exposée en production. |
| Détection de secrets avant commit (gitleaks) | Bloquer une fuite avant même le push | S | 🟢 | Complète la détection GitLab. |
| Décisions d'architecture tracées (ADR) | Expliquer les choix : Caddy, argon2, foyer, refresh token | S | 🟠 | `docs/adr/` : un fichier court par décision. |
| Journal des versions (CHANGELOG) | Lisibilité des versions | S | 🟢 | Généré à partir des messages de commit. |
| Budget de performance (Lighthouse CI, taille du bundle) | Application rapide sur mobile | S | 🟢 | |
| Renommer le dossier local en `miam-alert` | L'apostrophe casse la construction du front hors conteneur | S | 🟢 | Aucun impact sur le dépôt. |

---

## 6. Portfolio

| Idée | Intérêt | Effort | Priorité |
|---|---|---|---|
| Schéma d'architecture dans le README | Comprendre le projet en dix secondes | S | 🟠 |
| Compte de démonstration (données réinitialisées chaque nuit) | Essayer sans créer de compte | M | 🟢 |
| Courte vidéo du parcours (scan → alerte) | Montrer plutôt que décrire | S | 🟢 |
| Article « Security by design sur un projet perso » | Valoriser la démarche, support d'entretien | M | 🟢 |
| Passage du dépôt en public | Indispensable pour les candidatures | S | 🟠 |
