import type { ReactNode } from 'react';
import { ExternalLink, LegalLayout, LegalSection } from '../legal/LegalLayout';
import { HOST, PUBLISHER } from '../legal/publisher';

// Politique de confidentialité (RGPD, art. 13). Elle doit décrire ce que fait RÉELLEMENT
// l'application : à relire à chaque nouvelle donnée collectée ou nouveau prestataire.
export function PrivacyPage() {
  const contact = (
    <a href={`mailto:${PUBLISHER.email}`} className="font-semibold underline underline-offset-4">
      {PUBLISHER.email}
    </a>
  );

  return (
    <LegalLayout title="Politique de confidentialité">
      <p>
        Miam'Alert ne collecte que ce dont l'application a besoin pour fonctionner. Aucune donnée n'est vendue, aucune
        publicité n'est affichée, aucun outil de mesure d'audience ni traceur n'est utilisé.
      </p>

      <LegalSection title="Responsable du traitement">
        <p>
          {PUBLISHER.name}, éditeur de Miam'Alert. Contact : {contact}
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <Table
          head={['Donnée', 'Pourquoi']}
          rows={[
            ['Adresse email (obligatoire)', 'Vous identifier à la connexion et vous envoyer les emails liés à votre compte (confirmation de l’adresse).'],
            [
              'Mot de passe (obligatoire)',
              "Protéger votre compte. Il n'est jamais enregistré tel quel : seule une empreinte (argon2id) est conservée, illisible même par l'éditeur.",
            ],
            ['Prénom et nom (facultatifs)', "Vous saluer dans l'application. Modifiables et effaçables à tout moment depuis votre profil."],
            ['Inventaire', 'Les produits ajoutés (nom, quantité, date et type de date, statut) et les alertes du jour.'],
            ['Sessions', 'Une empreinte du jeton de connexion et sa date d’expiration, pour vous garder connecté.'],
            [
              'Adresse IP',
              'Journal de sécurité (connexions réussies ou échouées, excès de tentatives) et limitation du nombre de requêtes, contre les attaques.',
            ],
          ]}
        />
        <p>
          Ne sont pas collectés : numéro de téléphone, date de naissance, localisation, contacts, ni aucune donnée de
          navigation à des fins publicitaires.
        </p>
      </LegalSection>

      <LegalSection title="Finalités et bases légales">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Fournir le service</strong> (compte, inventaire, alertes) : exécution du service que vous demandez
            en créant un compte (RGPD, art. 6.1.b).
          </li>
          <li>
            <strong>Sécuriser l'application</strong> (journal de sécurité, limitation des tentatives) : intérêt légitime
            à protéger les comptes contre les intrusions (RGPD, art. 6.1.f).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Compte et inventaire : tant que le compte existe.</li>
          <li>Alertes du jour : 90 jours, puis supprimées automatiquement.</li>
          <li>
            Sessions : le jeton de connexion est valable 7 jours. Les traces d'une session expirée sont conservées 30
            jours (pour pouvoir enquêter en cas d'incident de sécurité), puis supprimées automatiquement.
          </li>
          <li>
            Liens envoyés par email (confirmation de l'adresse, mot de passe oublié) : valables 24 heures ou 30
            minutes, puis supprimés 30 jours après avoir servi ou expiré.
          </li>
          <li>
            Journaux techniques et de sécurité (adresses IP comprises) : 30 jours sur le serveur. Une copie chiffrée,
            impossible à modifier ou à effacer, est conservée 6 mois chez le prestataire de sauvegarde, pour pouvoir
            enquêter sur un incident de sécurité, puis supprimée automatiquement.
          </li>
          <li>
            Sauvegardes : 7 jours sur le serveur, 30 jours chez le prestataire de sauvegarde. Après la suppression d'un
            compte, ses données disparaissent donc des sauvegardes au plus tard 30 jours plus tard.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Qui a accès à vos données">
        <p>Seul l'éditeur administre l'application. Les prestataires suivants interviennent :</p>
        <ul className="space-y-3">
          {PROVIDERS.map((provider) => (
            <li key={provider.name} className="rounded-2xl border border-line p-4">
              <p className="font-bold">{provider.name}</p>
              <p className="mt-0.5 text-sm text-ink-600">{provider.role}</p>
              <p className="mt-2 text-sm">{provider.data}</p>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="Cookies et stockage sur votre appareil">
        <p>
          Miam'Alert utilise un seul cookie, <code className="rounded bg-mist px-1.5 py-0.5 text-sm">refresh_token</code>,
          qui vous garde connecté pendant 7 jours. Il est strictement nécessaire au fonctionnement du service : il
          n'exige donc pas votre consentement, et aucun bandeau ne vous le demande. Il n'est lisible par aucun script de
          la page et n'est envoyé qu'au serveur de Miam'Alert, uniquement pour renouveler votre session.
        </p>
        <p>
          L'application installée garde aussi ses propres fichiers (pages, styles, icônes) sur votre appareil pour
          s'ouvrir rapidement, même hors ligne. Ces fichiers ne contiennent aucune donnée personnelle : votre inventaire
          n'est jamais stocké sur l'appareil.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Connexions chiffrées (HTTPS), mots de passe protégés par argon2id, sessions révocables, accès à chaque donnée
          vérifié par le serveur, sauvegardes chiffrées et non modifiables, serveur durci. Les mesures en place sont
          détaillées dans la documentation de sécurité du projet.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez à tout moment accéder à vos données, les rectifier, les effacer, demander leur export dans un format
          lisible par une machine (portabilité), vous opposer à leur traitement ou en demander la limitation.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Prénom et nom : modifiables et effaçables directement depuis votre profil.</li>
          <li>
            Suppression du compte : depuis votre profil, après confirmation par votre mot de passe. Votre compte, votre
            inventaire et vos alertes sont effacés immédiatement (et des sauvegardes sous 30 jours).
          </li>
          <li>
            Accès et portabilité : depuis votre profil, « Télécharger mes données » fournit toutes vos données dans un
            fichier JSON.
          </li>
          <li>Pour toute autre demande : {contact}, depuis l'adresse de votre compte.</li>
        </ul>
        <p>
          Une réponse vous est apportée sous un mois. Si vous estimez que vos droits ne sont pas respectés, vous pouvez
          adresser une réclamation à la <ExternalLink href="https://www.cnil.fr/fr/plaintes">CNIL</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Modifications">
        <p>
          Cette politique est mise à jour à chaque évolution de l'application qui change les données collectées ou leurs
          destinataires. La date de dernière mise à jour figure en haut de cette page.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

// Prestataires qui traitent des données pour le compte de l'éditeur (sous-traitants, RGPD art. 28).
const PROVIDERS = [
  {
    name: HOST.name,
    role: `Hébergement du serveur, dans un ${HOST.serverLocation}.`,
    data: 'Toutes les données ci-dessus.',
  },
  {
    name: 'Brevo (France)',
    role: "Envoi des emails liés à votre compte, depuis l'Union européenne.",
    data: "Votre adresse email et le contenu de l'email (un lien de confirmation). Aucun email publicitaire.",
  },
  {
    name: 'Backblaze, Inc. (États-Unis)',
    role: "Stockage des sauvegardes et de l'archive des journaux, dans l'Union européenne (région EU Central).",
    data: "Sauvegardes et journaux (dont des adresses IP), chiffrés sur le serveur avant leur envoi : Backblaze ne peut pas les lire, la clé n'est détenue que par l'éditeur.",
  },
  {
    name: 'Open Food Facts (association, France)',
    role: 'Fiches et photos des produits scannés.',
    data: 'Le serveur ne transmet que le code-barres. Les photos des produits sont chargées par votre navigateur directement depuis Open Food Facts, qui reçoit donc votre adresse IP (mais pas la page consultée).',
  },
];

// Tableau simple, défilable horizontalement sur petit écran plutôt que de déborder de la page.
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-mist">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3.5 py-2.5 font-bold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-line align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={`px-3.5 py-2.5 ${cellIndex === 0 ? 'font-semibold' : 'text-ink-600'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
