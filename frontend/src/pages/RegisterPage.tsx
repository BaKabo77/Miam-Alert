import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/session';
import { ApiError } from '../lib/api';

export function RegisterPage() {
  const { session, register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      await register(String(form.get('email')), String(form.get('password')));
      navigate('/', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold text-green-700">Créer un compte</h1>

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
          <span className="text-sm text-gray-700">Mot de passe (12 caractères minimum)</span>
          {/* Mêmes règles que l'API, vérifiées ici pour le confort de l'utilisateur.
              "new-password" : le navigateur propose de générer un mot de passe fort. */}
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

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
          {submitting ? 'Patientez…' : 'Créer mon compte'}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-600">
        Déjà un compte ?{' '}
        <Link to="/login" className="text-green-700 underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'Un compte existe déjà avec cet email.';
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'Email invalide ou mot de passe trop court (12 caractères minimum).';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de tentatives. Réessayez dans une minute.';
  }
  return 'Une erreur est survenue. Réessayez.';
}
