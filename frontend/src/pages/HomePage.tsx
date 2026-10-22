import { useAuth } from '../auth/session';

// Page d'accueil provisoire : l'inventaire la remplacera à l'étape suivante.
export function HomePage() {
  const { session, logout } = useAuth();
  if (session.status !== 'authenticated') {
    return null;
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">Miam'Alert</h1>
        <button type="button" onClick={() => void logout()} className="text-sm text-gray-600 underline">
          Se déconnecter
        </button>
      </div>
      <p>
        Connecté en tant que <strong>{session.user.email}</strong>
      </p>
      <p className="text-gray-600">Foyer : {session.user.households[0]?.name}</p>
    </main>
  );
}
