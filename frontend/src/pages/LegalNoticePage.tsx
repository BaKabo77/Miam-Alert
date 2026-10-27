import { Link } from 'react-router';
import { ExternalLink, LegalLayout, LegalSection } from '../legal/LegalLayout';
import { HOST, PUBLISHER } from '../legal/publisher';

// Mentions légales (loi pour la confiance dans l'économie numérique, art. 6) : qui édite le site,
// qui l'héberge, et comment les contacter.
export function LegalNoticePage() {
  return (
    <LegalLayout title="Mentions légales">
      <LegalSection title="Éditeur">
        <p>
          Miam'Alert est un projet personnel, gratuit et sans but commercial, édité par {PUBLISHER.name}, particulier.
        </p>
        <p>
          Contact : <a href={`mailto:${PUBLISHER.email}`} className="font-semibold underline underline-offset-4">{PUBLISHER.email}</a>
          <br />
          Directeur de la publication : {PUBLISHER.name}
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          {HOST.name}, {HOST.address}. Téléphone : {HOST.phone}.
          <br />
          Les données sont hébergées dans un {HOST.serverLocation}.
        </p>
      </LegalSection>

      <LegalSection title="Données des produits">
        <p>
          Les fiches des produits (nom, marque, photo, Nutri-Score) proviennent d'
          <ExternalLink href="https://world.openfoodfacts.org">Open Food Facts</ExternalLink>, base de données
          collaborative publiée sous licence{' '}
          <ExternalLink href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License</ExternalLink>.
          Les photos des produits sont publiées sous licence{' '}
          <ExternalLink href="https://creativecommons.org/licenses/by-sa/3.0/deed.fr">CC BY-SA</ExternalLink> par
          les contributeurs d'Open Food Facts.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Les données collectées, leur usage et vos droits sont décrits dans la{' '}
          <Link to="/privacy" className="font-semibold underline underline-offset-4">
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Signaler un problème de sécurité">
        <p>
          Si vous découvrez une faille de sécurité, merci de la signaler à{' '}
          <a href={`mailto:${PUBLISHER.email}`} className="font-semibold underline underline-offset-4">{PUBLISHER.email}</a>{' '}
          sans la rendre publique, le temps qu'elle soit corrigée.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
