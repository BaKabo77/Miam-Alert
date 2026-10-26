import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/session';
import { LogoutIcon } from '../components/icons';
import { initials } from '../components/initials';
import { ApiError } from '../lib/api';

export function ProfilePage() {
  const { session, updateProfile, logout } = useAuth();
  const user = session.status === 'authenticated' ? session.user : null;

  // Formulaire contrôlé, pré-rempli avec le profil actuel.
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      // Un champ vide efface la donnée côté API (droit de rectification).
      const saved = await updateProfile({ firstName, lastName });
      // On affiche ce que l'API a réellement enregistré (espaces retirés, champs effacés).
      setFirstName(saved.firstName ?? '');
      setLastName(saved.lastName ?? '');
      setStatus('saved');
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus('error');
    }
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-flame text-2xl font-extrabold tracking-tight">Mon profil</h1>
        <p className="text-sm text-ink-500">Vos informations et votre session.</p>
      </div>

      <div className="card mb-4 flex items-center gap-4 p-4">
        <span
          aria-hidden="true"
          className="bg-flame-bright grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-bold text-white"
        >
          {initials(user.firstName, user.lastName) || '🙂'}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Nom non renseigné'}
          </p>
          <p className="truncate text-sm text-ink-500">{user.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card mb-4 space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Prénom</span>
            <input
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setStatus('idle');
              }}
              maxLength={100}
              autoComplete="given-name"
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Nom</span>
            <input
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value);
                setStatus('idle');
              }}
              maxLength={100}
              autoComplete="family-name"
              className="input"
            />
          </label>
        </div>
        <p className="text-xs text-ink-500">
          Facultatifs. Laissez un champ vide pour effacer l'information : elle est alors supprimée de nos
          données.
        </p>

        {/* role="status" : la confirmation est annoncée par les lecteurs d'écran. */}
        {status === 'saved' && (
          <p role="status" className="rounded-xl bg-fresh-50 px-3.5 py-2.5 text-sm text-fresh-700 ring-1 ring-fresh-100">
            Profil enregistré.
          </p>
        )}
        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={status === 'saving'} className="btn-primary w-full">
          {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <div className="card p-5">
        <p className="mb-3 text-sm text-ink-500">
          La déconnexion met fin à votre session sur cet appareil, y compris côté serveur.
        </p>
        <button type="button" onClick={() => void logout()} className="btn-secondary w-full">
          <LogoutIcon className="h-4 w-4" /> Se déconnecter
        </button>
      </div>
    </>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'Le prénom et le nom ne peuvent contenir que des lettres, espaces, apostrophes, traits d\'union et points (100 caractères max).';
  }
  return "L'enregistrement n'a pas pu aboutir. Réessayez.";
}
