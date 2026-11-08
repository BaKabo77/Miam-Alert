# Emails (`mail`)

Envoi des emails transactionnels : confirmation de l'adresse et réinitialisation du mot de passe. Aucun email publicitaire.

| Environnement | Serveur SMTP | Où voir les emails |
|---|---|---|
| Développement | **Mailpit** (service `mailpit` du `docker-compose.yml`) : capture tout, rien ne part | http://localhost:8025 |
| Tests e2e | Faux `Mailer` en mémoire pour les tests qui lisent les emails ; les autres envoient à Mailpit (celui du dev en local, un service éphémère en CI) | Dans le test lui-même |
| Production | **Brevo** (relais SMTP, société française, traitement dans l'UE) | Tableau de bord Brevo |

## Fonctionnement

- [`mailer.ts`](mailer.ts) définit le contrat : une classe abstraite `Mailer` avec une seule méthode, `send(message)`. **Le reste de l'application ne dépend que de ce contrat.**
- [`smtp-mailer.ts`](smtp-mailer.ts) l'implémente avec nodemailer :
  - **TLS obligatoire en production** (STARTTLS), impossible à désactiver par configuration : sans lui, les identifiants SMTP et les liens circuleraient en clair ;
  - délais courts (10 s pour la connexion) : un serveur lent ne bloque pas l'API ;
  - adresses passées **en objet** et non en texte, pour éviter l'analyseur d'adresses de nodemailer, où des failles ont permis d'ajouter un destinataire caché.
- [`mail.module.ts`](mail.module.ts) associe `Mailer` à `SmtpMailer`. Il est global : tout module peut injecter `Mailer` sans l'importer.
- [`templates.ts`](templates.ts) contient le texte des emails, en version texte et HTML :
  - **contenu fixe** : aucune donnée saisie par l'utilisateur (prénom, nom) n'y est insérée, ce qui écarte toute injection de HTML ;
  - le lien, construit par l'API, est quand même échappé.

Les envois sont lancés **en arrière-plan** par les services d'authentification : un serveur d'emails en panne ne fait échouer ni l'inscription, ni la demande de réinitialisation. Les erreurs sont journalisées sans l'adresse ni le lien.

## Configuration

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASSWORD` (facultatifs avec Mailpit), `MAIL_FROM` (l'expéditeur), `APP_URL` (base des liens). Voir [backend/README.md](../../README.md#configuration).

En production, le domaine `miam-alert.fr` est authentifié auprès de Brevo :
- **DKIM** : enregistrements `brevo1._domainkey` et `brevo2._domainkey` ;
- **SPF** : `include:spf.brevo.com` ;
- **DMARC** : en `p=none` pour commencer, à passer en `p=quarantine` une fois les rapports propres.

Sans ces enregistrements, les emails finissent en courrier indésirable.

## Ajouter un email

1. Ajouter une fonction dans `templates.ts`, qui renvoie un `MailMessage` (texte **et** HTML, contenu fixe, valeurs dynamiques échappées).
2. L'envoyer depuis le service concerné avec `this.mailer.send(...)`, en arrière-plan si la réponse HTTP n'a pas à l'attendre.
3. Limiter la fréquence d'envoi si la route est publique (voir le délai d'une minute dans [`auth/email-tokens.ts`](../auth/email-tokens.ts)).
4. Dans les tests e2e, remplacer `Mailer` par un faux qui garde les messages en mémoire :
   ```ts
   Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Mailer).useValue(fakeMailer)
   ```

## Commandes

```bash
# Emails capturés en dev : interface web, ou en ligne de commande
xdg-open http://localhost:8025
curl -s http://localhost:8025/api/v1/messages | jq '.messages[] | {to: .To[0].Address, subject: .Subject}'

# Tests des parcours qui envoient des emails
docker compose exec backend npm run test:e2e -- email-verification password-reset

# Échecs d'envoi (dev ; en production : prod logs api, voir docs/COMMANDES.md)
docker compose logs backend | grep -i 'email not sent'

# Enregistrements DNS d'authentification du domaine
dig +short TXT miam-alert.fr | grep spf
dig +short TXT _dmarc.miam-alert.fr
dig +short CNAME brevo1._domainkey.miam-alert.fr
```

## À savoir

- Éviter de créer en production des comptes de test avec des adresses inexistantes : les emails rejetés (*bounces*) nuisent à la réputation d'un domaine récent.
- Brevo est déclaré comme sous-traitant dans la politique de confidentialité.
- **Brevo réécrit les liens des emails** : le bouton pointe vers un domaine de Brevo (`*.sendibt2.com`, constaté le 2026-11-06), qui enregistre le clic puis redirige. Le jeton figure donc dans un lien conservé chez Brevo, même s'il est dans le fragment (`#`) de l'adresse d'origine. Aucune option d'envoi documentée ne le désactive sur un compte standard. Le **suivi anonymisé** est activé dans Brevo (depuis le 2026-11-08) : les ouvertures et les clics ne sont plus rattachés au destinataire dans ses journaux, mais les liens restent réécrits. Risque limité (usage unique, 30 min ou 24 h), accepté pour le lancement et annoncé dans la politique de confidentialité ; changement de prestataire prévu après la `v1.0` (voir [docs/EVOLUTIONS.md](../../../docs/EVOLUTIONS.md)).
