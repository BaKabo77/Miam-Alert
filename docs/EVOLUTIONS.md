# Évolutions possibles

Catalogue de tout ce qui pourrait être ajouté à Miam'Alert à terme : fonctionnalités, sécurité, exploitation, qualité. Ce n'est pas un engagement : c'est la réserve dans laquelle la [feuille de route](../README.md#feuille-de-route) vient piocher.

**Effort** : S = moins d'une journée, M = quelques jours, L = une semaine ou plus.
**Priorité** : 🔴 à faire vite (risque réel maintenant que l'application est en ligne), 🟠 prochaines versions, 🟢 un jour.

---

## Priorités recommandées

Dans l'ordre, maintenant que de vrais utilisateurs peuvent créer un compte :

1. ✅ ~~Sauvegardes de la base de données~~ : quotidiennes, chiffrées, restauration testée, copie immuable hors du serveur (v0.4.0).
2. ✅ ~~Mentions légales et politique de confidentialité~~ (v0.3.2).
3. 🔴 **Mot de passe oublié** : un utilisateur qui oublie son mot de passe perd son compte. ✅ Suppression du compte et export des données faits (v0.4.0).
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

### Foyer partagé

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| ✅ Invitation d'un membre par lien | Le foyer existe déjà dans le modèle | M | 🟢 | Jeton d'invitation aléatoire, haché en base, à usage unique, expirant (48 h). |
| ✅ Rôles `OWNER` / `MEMBER` | Seul le propriétaire invite, exclut, supprime le foyer | M | 🟢 | Guard dédié + tests d'escalade de privilèges (un membre tente une action de propriétaire). |
| ✅ Quitter un foyer, transférer la propriété | Cycle de vie complet | S | 🟢 | Un foyer ne doit jamais rester sans propriétaire. |
| Liste de courses partagée | Usage quotidien d'un foyer | M | 🟢 | Mêmes contrôles d'appartenance. |
| Qui a ajouté quel produit | Savoir qui a acheté quoi dans un foyer partagé | S | 🟢 | Identifiant de l'auteur sur l'article, effacé à la suppression du compte (`SetNull`). |

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
| ✅ Police mise en cache hors ligne (`woff2`) | Affichage identique hors ligne | S | Fait | |
| Audit d'accessibilité complet (lecteur d'écran, RGAA) | Inclusion, qualité perçue | M | 🟢 | |
| Traduction (anglais) | Portfolio lisible à l'international | M | 🟢 | |

---

## 2. Compte et données personnelles (RGPD)

| Idée | Intérêt | Effort | Priorité | Notes de sécurité |
|---|---|---|---|---|
| ✅ Mentions légales | Obligation légale (LCEN) : éditeur, hébergeur | S | Fait | |
| ✅ Politique de confidentialité | Obligation RGPD : données, finalités, durées, droits | S | Fait | Le seul cookie (session) est strictement nécessaire : pas de bandeau de consentement requis, à expliquer dans la politique. |
| Mot de passe oublié | Sinon, un oubli = compte perdu | M | 🔴 | Jeton aléatoire, haché, à usage unique, expirant (30 min) ; réponse identique que l'email existe ou non ; toutes les sessions révoquées après changement. |
| ✅ Suppression du compte | Droit à l'effacement (art. 17) | M | Fait | Ré-authentification avant suppression ; suppression réelle en cascade (foyer, articles, sessions, alertes). |
| ✅ Export des données | Droit à la portabilité (art. 20) | S | Fait | Export JSON des seules données de l'utilisateur ; rate limit. |
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

### Revue de sécurité des routes (2026-11-04)

Revue des 22 routes de l'API avant la `v1.0` : aucune faille critique, contrôle d'accès et IDOR conformes. Les points ci-dessous sont **reportés après la `v1.0`** (décision du développeur) ; chacun a été vérifié dans le code ou sur l'API de dev.

| Constat | Risque | Correction prévue | Effort | Priorité |
|---|---|---|---|---|
| L'inscription répond `409 Email already registered` | Énumération des comptes, alors que la connexion et « mot de passe oublié » la cachent | Même réponse dans tous les cas ; email au titulaire existant (« quelqu'un a tenté de créer un compte avec votre adresse »). Change l'écran d'après inscription du front | M | 🟠 |
| Connexion limitée par IP seulement (10/min) | *Credential stuffing* réparti sur de nombreuses IP contre un même compte | Limite par compte (ex. 5 échecs / 15 min), même erreur générique, jamais de blocage définitif (sinon blocage du compte d'autrui), dépassements journalisés. Voir « Verrouillage progressif par compte » ci-dessus | M | 🟠 |
| Corps de 16 à 64 Ko : réponse 500 et trace d'erreur journalisée, **avant** la limite de débit | Inondation des journaux (30 requêtes = 30 traces, vérifié) ; mauvais code HTTP | Erreurs du lecteur de corps (`PayloadTooLargeError`…) renvoyées avec leur code (413, 400), sans trace | S | 🟠 |
| `page` sans maximum (`?page=1e20` → 500) | Erreur interne provoquée à volonté | `@Max(10_000)` dans `PaginationQuery` | S | 🟢 |
| Aucun plafond d'articles par foyer | Consommation de ressources (OWASP API4) : ~144 000 articles/jour possibles, tous chargés par les suggestions de recettes | Plafond (ex. 1 000 articles actifs par foyer), erreur explicite au-delà | S | 🟢 |
| Réponse d'Open Food Facts lue sans limite de taille | Source externe non fiable : mémoire de l'API | Refus au-delà de 1 Mo (`Content-Length` et lecture bornée) | S | 🟢 |
| Erreurs inattendues journalisées avec leur message complet | Une erreur de validation Prisma (bug) peut contenir les valeurs de la requête (email) | Ne journaliser que le type et le code de l'erreur, plus la pile | S | 🟢 |
| Acceptation d'une nouvelle version des CGU exigée par le front seulement | Un client qui contourne le front utilise l'API sans l'accepter | 403 sur les routes métier tant que `termsAccepted` est faux | S | 🟢 |

### Suivi des liens par Brevo (2026-11-06)

Les emails passent par un domaine de Brevo (`*.sendibt2.com`), qui enregistre les clics et conserve le lien, jeton compris. D'après le forum de Brevo, la désactivation n'existe que sur demande pour les clients Enterprise ; seule une anonymisation des journaux est proposée.

| Évolution | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Changer de prestataire d'emails | Plus de liens réécrits ni conservés avec leur jeton, plus de domaine inconnu dans les emails | S | 🟠 | Candidat : Scaleway Transactional Email. Absence de suivi à vérifier sur un vrai email (seule source trouvée : la documentation d'Anymail). Changer les variables SMTP, DKIM, SPF et DMARC, le prestataire dans la politique de confidentialité, et retirer sa mention du suivi. |

Risque **accepté** : après un changement de mot de passe ou une suppression de compte, un access token déjà émis reste valable 15 minutes au plus (le vérifier en base coûterait une requête de plus partout).

---

## 4. Infrastructure et exploitation

### Sauvegardes et reprise

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| ✅ Sauvegarde quotidienne de PostgreSQL | Protéger les données | S | Fait | `pg_dump` planifié, **chiffré** (age ou GPG) avant de quitter le serveur. |
| ✅ Copie hors du serveur | Un serveur perdu ne doit pas emporter ses sauvegardes | S | Fait | Stockage objet dans l'UE ; identifiants en écriture seule (un serveur compromis ne peut pas effacer les sauvegardes). |
| ✅ Test de restauration régulier | Une sauvegarde jamais restaurée n'est pas une sauvegarde | S | Fait | Restauration d'essai à chaque sauvegarde ; restauration complète manuelle tous les trois mois. |
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
| Documentation OpenAPI (Swagger) | API documentée, utile pour l'app mobile et les futurs développeurs | S | 🟢 | Activée en développement uniquement, jamais exposée en production. |
| Détection de secrets avant commit (gitleaks) | Bloquer une fuite avant même le push | S | 🟢 | Complète la détection GitLab. |
| Décisions d'architecture tracées (ADR) | Expliquer les choix : Caddy, argon2, foyer, refresh token | S | 🟠 | `docs/adr/` : un fichier court par décision. |
| Journal des versions (CHANGELOG) | Lisibilité des versions | S | 🟢 | Généré à partir des messages de commit. |
| Budget de performance (Lighthouse CI, taille du bundle) | Application rapide sur mobile | S | 🟢 | |
| Renommer le dossier local en `miam-alert` | L'apostrophe casse la construction du front hors conteneur | S | 🟢 | Aucun impact sur le dépôt. |

---

## 6. Lancement et modèle économique

| Idée | Intérêt | Effort | Priorité | Notes |
|---|---|---|---|---|
| Page d'accueil présentant l'application | Expliquer l'application avant l'inscription | S | 🟠 | Statique, mêmes en-têtes de sécurité. |
| Compte de démonstration (données réinitialisées chaque nuit) | Essayer sans créer de compte (visiteurs, recruteurs) | M | 🟢 | Compte isolé, actions destructives désactivées. |
| CGU et contact de support | Indispensables pour un lancement public | S | 🟠 | |
| Mesure d'audience sans cookie (Plausible ou Matomo auto-hébergé) | Comprendre l'usage sans bandeau de consentement | S | 🟠 | Auto-hébergée : aucune donnée envoyée à un tiers. |
| Statut (micro-entreprise), CGV, rétractation, médiateur | Prérequis légaux de l'offre payante | S | 🟠 | Avant le lancement du Premium. |
| Abonnement Premium avec Stripe | Financer l'application et les coûts d'IA | L | 🟠 | Checkout et portail Stripe, webhooks signés et idempotents, statut vérifié côté serveur. |
| Quotas d'IA par offre | Un utilisateur ne doit pas coûter plus qu'il ne rapporte | M | 🟠 | Vérifiés avant chaque appel au modèle. |
