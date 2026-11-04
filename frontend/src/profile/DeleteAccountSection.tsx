import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/session';
import { TrashIcon } from '../components/icons';
import { ApiError } from '../lib/api';

// Suppression du compte : en deux temps (on ouvre la zone, puis on confirme avec le mot de passe),
// pour qu'un clic malheureux ne puisse rien effacer.
export function DeleteAccountSection() {
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
    } catch (caught) {
      setError(errorMessage(caught));
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn w-full text-tomato-700 hover:bg-tomato-100">
        <TrashIcon className="h-4 w-4" /> Supprimer mon compte
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-tomato-100 p-5">
      <div>
        <h2 className="text-lg font-extrabold text-tomato-700">Supprimer mon compte</h2>
        <p className="mt-1 text-sm">
          Votre compte, votre inventaire et vos alertes seront effacés définitivement. Cette action est
          irréversible. Un foyer partagé reste à ses autres membres, avec son inventaire.
        </p>
      </div>

      <label className="block">
        <span className="label">Confirmez avec votre mot de passe</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          maxLength={128}
          autoComplete="current-password"
          className="input"
        />
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
        <button
          type="submit"
          disabled={deleting}
          className="btn flex-1 bg-tomato-700 text-white hover:brightness-110"
        >
          {deleting ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
    </form>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return 'Mot de passe incorrect.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Trop de tentatives. Réessayez dans une minute.';
  }
  return "La suppression n'a pas pu aboutir. Réessayez.";
}
