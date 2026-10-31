import { Link } from 'react-router';
import { ExternalLink, LegalLayout, LegalSection } from '../legal/LegalLayout';
import { PUBLISHER } from '../legal/publisher';
import { TERMS_DATE_LABEL } from '../legal/terms';

// Conditions générales d'utilisation (CGU) du service gratuit. Elles doivent décrire ce que fait
// RÉELLEMENT l'application. Toute modification de fond change TERMS_VERSION (front ET backend) :
// chaque compte devra les accepter de nouveau.
export function TermsPage() {
  const contact = (
    <a href={`mailto:${PUBLISHER.email}`} className="font-semibold underline underline-offset-4">
      {PUBLISHER.email}
    </a>
  );
  const privacy = (
    <Link to="/privacy" className="font-semibold underline underline-offset-4">
      politique de confidentialité
    </Link>
  );

  return (
    <LegalLayout title="Conditions générales d'utilisation" lastUpdated={TERMS_DATE_LABEL}>
      <p>
        Ces conditions encadrent l'utilisation de Miam'Alert. Créer un compte implique de les avoir lues et acceptées.
      </p>

      <LegalSection title="1. Le service">
        <p>
          Miam'Alert aide à suivre les dates de péremption des produits alimentaires d'un foyer : inventaire, scan des
          codes-barres, alerte quotidienne et idées de recettes pour finir en priorité les produits qui périment le plus
          vite. Le service est édité par {PUBLISHER.name} (voir les{' '}
          <Link to="/legal" className="font-semibold underline underline-offset-4">
            mentions légales
          </Link>
          ) et il est <strong>gratuit</strong>.
        </p>
      </LegalSection>

      <LegalSection title="2. Votre compte">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Un compte est personnel. Vous fournissez une adresse email valide dont vous êtes titulaire.</li>
          <li>
            Vous gardez votre mot de passe secret. Si vous pensez qu'il est connu d'un tiers, changez-le depuis votre
            profil : toutes vos autres sessions sont alors fermées.
          </li>
          <li>Vous pouvez supprimer votre compte et toutes vos données à tout moment, depuis votre profil.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Les informations fournies par l'application">
        <p>
          Les dates suggérées, les niveaux d'urgence, les alertes et les recettes sont une <strong>aide</strong>. Ils ne
          remplacent ni la date imprimée sur l'emballage, ni votre propre jugement :
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            une <strong>DLC</strong> (« à consommer jusqu'au ») dépassée signifie que le produit ne doit plus être consommé
            ; l'application ne propose jamais de recette avec un tel produit ;
          </li>
          <li>
            les recettes n'indiquent pas tous les <strong>allergènes</strong> : vérifiez la composition des produits si
            vous ou vos invités avez une allergie ou une intolérance ;
          </li>
          <li>
            les fiches des produits viennent d'
            <ExternalLink href="https://world.openfoodfacts.org">Open Food Facts</ExternalLink>, base collaborative qui peut
            contenir des erreurs.
          </li>
        </ul>
        <p>
          L'éditeur ne peut être tenu responsable d'un dommage résultant d'une information affichée par l'application
          sans vérification de votre part, ni d'une date saisie de façon erronée.
        </p>
      </LegalSection>

      <LegalSection title="4. Utilisation acceptable">
        <p>Il est interdit :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>de tenter d'accéder aux données d'un autre utilisateur ou de contourner les mesures de sécurité ;</li>
          <li>
            d'utiliser des scripts ou robots pour envoyer des requêtes en masse, ou d'utiliser l'application pour aspirer
            les données d'Open Food Facts ;
          </li>
          <li>de perturber le fonctionnement du service.</li>
        </ul>
        <p>
          En cas de manquement, l'éditeur peut suspendre ou supprimer le compte concerné. Une faille de sécurité
          découverte de bonne foi peut être signalée à {contact}, sans la rendre publique le temps de la corriger.
        </p>
      </LegalSection>

      <LegalSection title="5. Disponibilité">
        <p>
          Le service est fourni gratuitement, sans garantie de disponibilité permanente. Il peut être interrompu pour
          maintenance, notamment pour appliquer des correctifs de sécurité, ou évoluer. Les données sont sauvegardées
          chaque nuit.
        </p>
      </LegalSection>

      <LegalSection title="6. Données personnelles">
        <p>
          Les données collectées, leur durée de conservation et vos droits (accès, export, rectification, suppression)
          sont décrits dans la {privacy}.
        </p>
      </LegalSection>

      <LegalSection title="7. Propriété intellectuelle">
        <p>
          L'application, son code, son apparence et les recettes rédigées pour Miam'Alert appartiennent à l'éditeur. Les
          données des produits sont publiées par Open Food Facts sous licence{' '}
          <ExternalLink href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License</ExternalLink>, et
          leurs photos sous licence{' '}
          <ExternalLink href="https://creativecommons.org/licenses/by-sa/3.0/deed.fr">CC BY-SA</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection title="8. Modification des conditions">
        <p>
          Ces conditions peuvent évoluer, notamment avec l'arrivée de nouvelles fonctionnalités. La nouvelle version vous
          sera présentée à votre prochaine connexion et devra être acceptée pour continuer à utiliser le service ; à
          défaut, vous pouvez supprimer votre compte.
        </p>
      </LegalSection>

      <LegalSection title="9. Droit applicable et contact">
        <p>
          Ces conditions sont soumises au droit français. Pour toute question ou réclamation : {contact}. En cas de
          litige, une solution amiable sera recherchée avant toute action ; à défaut, les tribunaux compétents sont ceux
          désignés par la loi.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
