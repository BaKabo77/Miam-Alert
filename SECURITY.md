# Politique de sécurité

Miam'Alert est conçu **security by design** : chaque fonctionnalité est pensée, codée et testée avec la sécurité en tête, en s'appuyant sur l'[OWASP Top 10](https://owasp.org/Top10/) et l'[OWASP API Security Top 10](https://owasp.org/API-Security/).

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique**. Ouvrez une **issue confidentielle** sur le dépôt GitLab (case « This issue is confidential »), en décrivant :

- la faille et son impact ;
- les étapes pour la reproduire ;
- si possible, une piste de correction.

Vous recevrez une réponse sous 7 jours. La faille sera corrigée en priorité, puis mentionnée (avec votre accord) dans les notes de version.

Merci de tester uniquement avec vos propres comptes, sans accéder aux données d'autres utilisateurs, sans déni de service et sans ingénierie sociale.

## Versions maintenues

Seule la dernière version publiée (tag `vX.Y.Z` sur `main`), déployée sur [miam-alert.fr](https://miam-alert.fr), reçoit des correctifs.

## Mesures en place, par risque OWASP

| Risque OWASP | Mesures |
|---|---|
| **A01 Contrôle d'accès** / API1 BOLA | Refus par défaut (guard JWT global, routes publiques explicites) ; appartenance au foyer vérifiée sur chaque ressource ou intégrée à la requête SQL ; `404` pour la ressource d'un autre foyer ; rôles du foyer partagé (propriétaire, membre) vérifiés par un guard dédié (`403` pour un membre) ; invitations par lien aléatoire, haché en base, à usage unique et expirant (7 jours) ; identifiants UUID ; tests e2e d'accès croisé (IDOR) et de rôle systématiques. |
| **A02 Défaillances cryptographiques** | Mots de passe en argon2id ; refresh token aléatoire de 256 bits stocké haché (SHA-256) ; HTTPS obligatoire (TLS 1.2+, HSTS) ; secrets de production générés sur le serveur. |
| **A03 Injection** | Requêtes Prisma paramétrées uniquement (requêtes brutes non sécurisées interdites) ; affichage échappé par React ; CSP stricte sans script en ligne. |
| **A04 Conception non sécurisée** | Modèle de menaces pris en compte dès la conception (foyer propriétaire des données, détection de vol de refresh token, alerte idempotente) ; limites connues documentées dans le README. |
| **A05 Mauvaise configuration** | Variables d'environnement validées au démarrage ; en-têtes de sécurité (helmet, CSP, Permissions-Policy) ; CORS en liste blanche ; erreurs internes jamais renvoyées au client ; conteneurs non-root, en lecture seule, sans capacité ; base non exposée, API connectée avec un rôle limité aux lignes (ni modification du schéma ni droit d'administration ; migrations avec un rôle propriétaire distinct, sans superutilisateur) ; serveur durci (SSH par clé, pare-feu, fail2ban). |
| **A06 Composants vulnérables** | Dépendances verrouillées ; `npm audit` bloquant en CI ; scripts d'installation npm bloqués sauf autorisation ; images de production minimales ; mises à jour de sécurité automatiques du serveur. |
| **A07 Authentification** / API2 | Access token de 15 min, algorithme imposé ; refresh token en cookie `HttpOnly`, `Secure`, `SameSite=Strict`, avec rotation et révocation de toute la session en cas de réutilisation ; message d'erreur et temps de réponse identiques que l'email existe ou non ; rate limiting renforcé sur `/auth`. |
| **A08 Intégrité** | Branches protégées, merge request avec pipeline vert obligatoire ; clé de signature du dépôt Docker vérifiée ; clé de déploiement en lecture seule. |
| **A09 Journalisation** | Événements de sécurité en JSON (connexions, échecs, vol de session, accès refusés, rate limit) avec la vraie IP du client ; champs journalisables imposés par le typage, sans email, mot de passe ni token ; journal d'audit système (commandes root, comptes, SSH, secrets) ; journaux conservés 30 jours sur le serveur ; leur copie hors du serveur, chiffrée et non modifiable (`deploy/logship/`), est prête mais pas encore en service. |
| **A10 SSRF** | Appels sortants limités à une URL fixe d'Open Food Facts, code-barres validé avant l'appel, redirections refusées, timeout ; données reçues validées et nettoyées. |
| API3 Exposition de propriétés / mass assignment | DTO stricts (champs inconnus rejetés) ; réponses construites explicitement, hash du mot de passe exclu par défaut. |
| API4 Consommation de ressources | Rate limiting global et par route ; corps de requête limité (16 ko) ; pagination bornée ; logs Docker plafonnés. |

Le détail de chaque mesure est dans la section [Sécurité du README](README.md#sécurité).
