import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/session';
import { AuthLayout } from '../components/AuthLayout';
import { ApiError, apiRequest } from '../lib/api';

// Page ouverte depuis l'email : /reset-password#token=...
export function ResetPasswordPage() {
  const { session, logout } = useAuth();
  // Jeton lu une seule fois dans le fragment de l'URL, puis retiré de la barre d'adresse et de
  // l'historique (voir l'effet ci-dessous) : il ne reste visible nulle part.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'));
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'invalid'>(token ? 'idle' : 'invalid');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setStatus('saving');
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword: data.get('newPassword') },
        retryOnUnauthorized: false,
      });
      // Toutes les sessions ont été fermées par l'API : celle de cet appareil aussi.
      if (session.status === 'authenticated') {
        await logout();
      }
      setStatus('done');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400 && token) {
        // 400 : jeton invalide ou expiré (le mot de passe est déjà vérifié par le formulaire).
        setStatus('invalid');
      } else {
        setError("Le changement n'a pas pu aboutir. Réessayez.");
        setStatus('idle');
      }
    }
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez-le, puis connectez-vous." footer={null}>
      {status === 'done' && (
        <div className="space-y-4">
          <p role="status" className="alert-success">
            Mot de passe modifié. Tous vos appareils ont été déconnectés.
          </p>
          <Link to="/login" className="btn-primary w-full">
            Se connecter
          </Link>
        </div>
      )}

      {status === 'invalid' && (
        <div className="space-y-4">
          <p role="alert" className="alert-error">
            Ce lien n'est pas valable : il a peut-être expiré (30 minutes) ou déjà servi.
          </p>
          <Link to="/forgot-password" className="btn-primary w-full">
            Demander un nouveau lien
          </Link>
        </div>
      )}

      {(status === 'idle' || status === 'saving') && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="label">Nouveau mot de passe</span>
            <input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="input" />
            <span className="mt-2 block text-xs text-ink-600">12 caractères minimum. Une phrase est idéale.</span>
          </label>
          <label className="block">
            <span className="label">Confirmer le mot de passe</span>
            <input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="input" />
          </label>
          {error && (
            <p role="alert" className="alert-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={status === 'saving'} className="btn-primary w-full">
            {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
