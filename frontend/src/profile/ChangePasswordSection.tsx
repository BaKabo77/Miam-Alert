import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/session';
import { ApiError } from '../lib/api';

export function ChangePasswordSection() {
  const { changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setStatus('saving');
    try {
      await changePassword(String(data.get('currentPassword')), String(data.get('newPassword')));
      form.reset();
      setOpen(false);
      setStatus('saved');
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus('idle');
    }
  }

  return (
    <div>
      <h2 className="text-lg font-extrabold">Mot de passe</h2>

      {status === 'saved' && (
        <p role="status" className="alert-success mt-3">
          Mot de passe modifié. Vos autres appareils ont été déconnectés.
        </p>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary mt-4 w-full">
          Changer mon mot de passe
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="label">Mot de passe actuel</span>
            <input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" className="input" />
          </label>
          <label className="block">
            <span className="label">Nouveau mot de passe</span>
            {/* "new-password" : le navigateur propose d'en générer un et de l'enregistrer. */}
            <input
              name="newPassword"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              className="input"
            />
            <span className="mt-2 block text-xs text-ink-600">
              12 caractères minimum. Vos autres appareils seront déconnectés.
            </span>
          </label>

          {error && (
            <p role="alert" className="alert-error">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">
              Annuler
            </button>
            <button type="submit" disabled={status === 'saving'} className="btn-primary flex-1">
              {status === 'saving' ? 'Modification…' : 'Modifier'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'Mot de passe actuel incorrect.';
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'Le nouveau mot de passe doit faire au moins 12 caractères et être différent de l’actuel.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de tentatives. Réessayez dans une minute.';
  }
  return "Le changement n'a pas pu aboutir. Réessayez.";
}
