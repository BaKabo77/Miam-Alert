import { useQuery } from '@tanstack/react-query';
import { AlertBanner } from '../alerts/AlertBanner';
import { Link } from 'react-router';
import { useAuth, useHouseholdId } from '../auth/session';
import { BasketIcon, PlusIcon, ScanIcon } from '../components/icons';
import { fetchPantryItems, type PantryItem } from '../pantry/pantry-api';
import { PantryItemRow } from '../pantry/PantryItemRow';

export function InventoryPage() {
  const householdId = useHouseholdId();
  const { session } = useAuth();
  const firstName = session.status === 'authenticated' ? session.user.firstName : null;

  // TanStack Query appelle l'API et nous donne : les données, "en cours de chargement ?", "erreur ?".
  const { data: items, isPending, isError } = useQuery({
    queryKey: ['pantry-items', householdId],
    queryFn: () => fetchPantryItems(householdId),
  });

  return (
    <>
      <div className="mb-6">
        {firstName && <p className="mb-1 text-[15px] font-semibold text-ink-600">Bonjour {firstName}</p>}
        <h1 className="page-title">Mon inventaire</h1>
        <p className="page-subtitle">
          {items ? `${items.length} produit${items.length > 1 ? 's' : ''}, du plus urgent au moins urgent` : ' '}
        </p>
      </div>

      <AlertBanner householdId={householdId} />

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

// Trois compteurs colorés en haut de la page : l'essentiel avant même de lire la liste.
function Summary({ items }: { items: PantryItem[] }) {
  const count = (...levels: PantryItem['urgency'][]) => items.filter((item) => levels.includes(item.urgency)).length;
  const tiles = [
    { label: 'Périmés', value: count('EXPIRED'), className: 'bg-tomato-100 text-tomato-700' },
    { label: 'À manger vite', value: count('URGENT', 'PAST_BEST_BEFORE'), className: 'bg-peach-100 text-peach-800' },
    { label: 'Cette semaine', value: count('SOON'), className: 'bg-sun-100 text-sun-800' },
  ];

  return (
    <div className="mb-6 grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <div key={tile.label} className={`rounded-3xl p-4 ${tile.className}`}>
          <p className="text-[32px] leading-none font-black tracking-[-0.04em] text-ink-900">{tile.value}</p>
          <p className="mt-2 text-xs leading-tight font-bold">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-mint-100 px-6 py-10 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-mint-800">
        <BasketIcon className="h-8 w-8" />
      </span>
      <p className="mt-4 text-xl font-extrabold tracking-[-0.02em]">Votre inventaire est vide</p>
      <p className="mt-1 text-[15px] text-ink-600">Scannez vos courses pour suivre leurs dates de péremption.</p>
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
        <div key={index} className="card flex animate-pulse items-center gap-3 p-4">
          <div className="h-16 w-16 rounded-2xl bg-mist" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 rounded-full bg-mist" />
            <div className="h-3 w-3/4 rounded-full bg-mist" />
          </div>
        </div>
      ))}
    </div>
  );
}
