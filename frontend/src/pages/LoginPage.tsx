import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/session';
import { AuthLayout } from '../components/AuthLayout';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Déjà connecté : rien à faire ici.
  if (session.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // empêche le navigateur de recharger la page
    const form = new FormData(event.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      navigate('/', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Content de vous revoir !"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-bold text-ink-900 underline underline-offset-4 hover:text-peach-800">
            Créer un compte
          </Link>
        </>
      }
    >
      {session.status === 'anonymous' && session.accountDeleted && (
        <p role="status" className="alert-success mb-4">
          Votre compte et toutes vos données ont été supprimés.
        </p>
      )}

      {/* Hors ligne, l'application s'ouvre (PWA) mais la session ne peut pas être vérifiée. */}
      {!navigator.onLine && (
        <p className="alert-warning mb-4">Vous êtes hors ligne. La connexion nécessite un accès au réseau.</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" className="input" />
        </label>

        <label className="block">
          <span className="label">Mot de passe</span>
          <input
            name="password"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            className="input"
          />
          <Link to="/forgot-password" className="mt-2 inline-block text-sm font-semibold underline underline-offset-4">
            Mot de passe oublié ?
          </Link>
        </label>

        {/* Le message n'apparaît que s'il y a une erreur. role="alert" : lu par les lecteurs d'écran. */}
        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </AuthLayout>
  );
}

// Jamais de détail technique, et le même message que l'API pour un email inconnu
// ou un mauvais mot de passe (on ne révèle pas si le compte existe).
function errorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
    return 'Email ou mot de passe incorrect.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de tentatives. Réessayez dans une minute.';
  }
  return 'Une erreur est survenue. Réessayez.';
}
