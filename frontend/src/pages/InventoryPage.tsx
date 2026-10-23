import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useHouseholdId } from '../auth/session';
import { PlusIcon, ScanIcon } from '../components/icons';
import { fetchPantryItems, type PantryItem } from '../pantry/pantry-api';
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
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Mon inventaire</h1>
        <p className="text-sm text-ink-500">
          {items ? `${items.length} produit${items.length > 1 ? 's' : ''}, du plus urgent au moins urgent` : ' '}
        </p>
      </div>

      {isPending && <LoadingSkeleton />}

      {isError && (
        <p role="alert" className="alert-error">
          Impossible de charger l'inventaire. Réessayez plus tard.
        </p>
      )}

      {items && items.length === 0 && <EmptyState />}

      {items && items.length > 0 && (
        <>
          <Summary items={items} />
          <ul className="space-y-3">
            {items.map((item) => (
              <PantryItemRow key={item.id} item={item} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// Trois compteurs en haut de la page : l'essentiel avant même de lire la liste.
function Summary({ items }: { items: PantryItem[] }) {
  const count = (...levels: PantryItem['urgency'][]) => items.filter((item) => levels.includes(item.urgency)).length;
  const tiles = [
    { label: 'Périmés', value: count('EXPIRED'), className: 'from-red-50 to-white text-red-700' },
    { label: 'À manger vite', value: count('URGENT', 'PAST_BEST_BEFORE'), className: 'from-amber-50 to-white text-amber-800' },
    { label: 'Cette semaine', value: count('SOON'), className: 'from-yellow-50 to-white text-yellow-800' },
  ];

  return (
    <div className="mb-5 grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <div key={tile.label} className={`card bg-linear-to-b p-3 ${tile.className}`}>
          <p className="text-2xl font-bold">{tile.value}</p>
          <p className="text-[11px] font-semibold leading-tight">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card px-6 py-10 text-center">
      <p className="text-4xl" aria-hidden="true">
        🧺
      </p>
      <p className="mt-3 font-semibold">Votre inventaire est vide</p>
      <p className="mt-1 text-sm text-ink-500">Scannez vos courses pour suivre leurs dates de péremption.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/scan" className="btn-primary">
          <ScanIcon className="h-4 w-4" /> Scanner
        </Link>
        <Link to="/add" className="btn-secondary">
          <PlusIcon className="h-4 w-4" /> Ajouter
        </Link>
      </div>
    </div>
  );
}

// Formes grises animées pendant le chargement : la page ne « saute » pas à l'arrivée des données.
function LoadingSkeleton() {
  return (
    <div aria-label="Chargement" className="space-y-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="card flex animate-pulse items-center gap-3 p-3">
          <div className="h-14 w-14 rounded-xl bg-black/5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 rounded bg-black/5" />
            <div className="h-3 w-3/4 rounded bg-black/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
