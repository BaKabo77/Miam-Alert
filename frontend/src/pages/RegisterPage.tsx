import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/session';
import { AuthLayout } from '../components/AuthLayout';
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
    <AuthLayout
      title="Créer un compte"
      subtitle="Quelques secondes pour arrêter de gaspiller."
      footer={
        <>
          Déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <span className="mt-1.5 block text-xs text-ink-500">12 caractères minimum. Une phrase est idéale.</span>
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
    return 'Email invalide ou mot de passe trop court (12 caractères minimum).';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de tentatives. Réessayez dans une minute.';
  }
  return 'Une erreur est survenue. Réessayez.';
}
