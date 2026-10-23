import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useHouseholdId } from '../auth/session';
import { fetchPantryItems } from '../pantry/pantry-api';
import { PantryItemRow } from '../pantry/PantryItemRow';

export function InventoryPage() {
  const householdId = useHouseholdId();

  // TanStack Query appelle l'API et nous donne : les données, "en cours de chargement ?", "erreur ?".
  const { data: items, isPending, isError } = useQuery({
    queryKey: ['pantry-items', householdId],
    queryFn: () => fetchPantryItems(householdId),
  });

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Mon inventaire</h1>

      {isPending && <p className="text-gray-500">Chargement…</p>}

      {isError && <p className="text-red-700">Impossible de charger l'inventaire. Réessayez plus tard.</p>}

      {items && items.length === 0 && (
        <p className="text-gray-500">
          Votre inventaire est vide.{' '}
          <Link to="/add" className="text-green-700 underline">
            Ajouter un produit
          </Link>
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded bg-white px-3 shadow-sm">
          {items.map((item) => (
            <PantryItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}
