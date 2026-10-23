import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/session';
import { fetchPantryItems } from '../pantry/pantry-api';
import { PantryItemRow } from '../pantry/PantryItemRow';

export function InventoryPage() {
  const { session, logout } = useAuth();
  // Le foyer de l'utilisateur connecté (la V1 n'en a qu'un).
  const householdId = session.status === 'authenticated' ? session.user.households[0]?.id : undefined;

  // TanStack Query appelle l'API et nous donne : les données, "en cours de chargement ?", "erreur ?".
  const { data: items, isPending, isError } = useQuery({
    queryKey: ['pantry-items', householdId],
    queryFn: () => fetchPantryItems(householdId!),
    enabled: householdId !== undefined,
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-700">Mon inventaire</h1>
        <button type="button" onClick={() => void logout()} className="text-sm text-gray-600 underline">
          Se déconnecter
        </button>
      </div>

      {isPending && <p className="text-gray-500">Chargement…</p>}

      {isError && <p className="text-red-700">Impossible de charger l'inventaire. Réessayez plus tard.</p>}

      {items && items.length === 0 && <p className="text-gray-500">Votre inventaire est vide.</p>}

      {items && items.length > 0 && (
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <PantryItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
