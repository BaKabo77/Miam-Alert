import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/session';
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
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold text-green-700">Connexion</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-700">Mot de passe</span>
          <input
            name="password"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        {/* Le message n'apparaît que s'il y a une erreur. role="alert" : lu par les lecteurs d'écran. */}
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-green-700 px-3 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {submitting ? 'Patientez…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link to="/register" className="text-green-700 underline">
          Créer un compte
        </Link>
      </p>
    </main>
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
