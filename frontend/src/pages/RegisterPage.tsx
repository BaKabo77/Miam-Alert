import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { returnPath, useAuth } from '../auth/session';
import { AuthLayout } from '../components/AuthLayout';
import { TERMS_VERSION } from '../legal/terms';
import { trackEvent } from '../lib/analytics';
import { ApiError } from '../lib/api';

export function RegisterPage() {
  const { session, register } = useAuth();
  const navigate = useNavigate();
  // Page demandée avant la connexion (un lien d'invitation, par exemple), sinon l'accueil.
  const location = useLocation();
  const next = returnPath(location.state);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session.status === 'authenticated') {
    return <Navigate to={next} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    // Saisie en double contre la faute de frappe (le mot de passe est masqué) : une erreur ici
    // rendrait le compte inaccessible dès sa création. Vérifiée côté navigateur seulement.
    if (form.get('password') !== form.get('confirmPassword')) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        email: String(form.get('email')),
        password: String(form.get('password')),
        firstName: String(form.get('firstName') ?? ''),
        lastName: String(form.get('lastName') ?? ''),
        // La case est obligatoire (required) : on envoie la version des CGU qu'elle désigne.
        termsVersion: TERMS_VERSION,
      });
      trackEvent('signup');
      navigate(next, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Quelques secondes pour arrêter de gaspiller."
      footer={
        <>
          Déjà un compte ?{' '}
          <Link to="/login" state={location.state} className="font-bold text-ink-900 underline underline-offset-4 hover:text-peach-800">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Facultatifs : seulement pour vous saluer (minimisation des données personnelles). */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">
              Prénom <span className="font-normal text-ink-600">(facultatif)</span>
            </span>
            <input name="firstName" maxLength={100} autoComplete="given-name" className="input" />
          </label>
          <label className="block">
            <span className="label">
              Nom <span className="font-normal text-ink-600">(facultatif)</span>
            </span>
            <input name="lastName" maxLength={100} autoComplete="family-name" className="input" />
          </label>
        </div>

        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" className="input" />
        </label>

        <label className="block">
          <span className="label">Mot de passe</span>
          {/* Mêmes règles que l'API, vérifiées ici pour le confort de l'utilisateur.
              "new-password" : le navigateur propose de générer un mot de passe fort. */}
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            className="input"
          />
          <span className="mt-2 block text-xs text-ink-600">12 caractères minimum. Une phrase est idéale.</span>
        </label>

        <label className="block">
          <span className="label">Confirmer le mot de passe</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            className="input"
          />
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input name="acceptTerms" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-ink-900" />
          <span>
            J'ai lu et j'accepte les{' '}
            {/* Nouvel onglet : le formulaire déjà rempli n'est pas perdu. */}
            <Link to="/terms" target="_blank" className="font-semibold underline underline-offset-4">
              conditions générales d'utilisation
            </Link>
            .
          </span>
        </label>

        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthLayout>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'Un compte existe déjà avec cet email.';
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'Vérifiez les champs : email valide, mot de passe de 12 caractères minimum, nom et prénom sans chiffres.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de tentatives. Réessayez dans une minute.';
  }
  return 'Une erreur est survenue. Réessayez.';
}
