import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CheckIcon, SnowflakeIcon, TrashIcon } from '../components/icons';
import { type PantryItem, type PantryItemStatus, updatePantryItemStatus } from './pantry-api';

// Un style par niveau d'urgence. Record<…> oblige TypeScript à vérifier qu'aucun niveau
// n'est oublié : si l'API en ajoute un, le code ne compilera plus tant qu'il n'est pas traité ici.
const URGENCY_STYLES: Record<PantryItem['urgency'], { label: string; colors: string }> = {
  EXPIRED: { label: 'Périmé', colors: 'bg-tomato-100 text-tomato-700' },
  PAST_BEST_BEFORE: { label: 'Date dépassée', colors: 'bg-peach-100 text-peach-800' },
  URGENT: { label: 'À consommer vite', colors: 'bg-peach-100 text-peach-800' },
  SOON: { label: 'Cette semaine', colors: 'bg-sun-100 text-sun-800' },
  OK: { label: 'OK', colors: 'bg-mint-100 text-mint-800' },
};

// Les actions proposées sur chaque article : il quitte alors l'inventaire actif.
// (Les statuts consommé / jeté serviront aux statistiques de gaspillage.)
const ACTIONS: { status: PantryItemStatus; label: string; icon: ReactNode; className: string }[] = [
  { status: 'CONSUMED', label: 'Consommé', icon: <CheckIcon className="h-4 w-4" />, className: 'hover:bg-mint-100 hover:text-mint-800' },
  { status: 'FROZEN', label: 'Congelé', icon: <SnowflakeIcon className="h-4 w-4" />, className: 'hover:bg-ice-100 hover:text-ice-700' },
  { status: 'WASTED', label: 'Jeté', icon: <TrashIcon className="h-4 w-4" />, className: 'hover:bg-tomato-100 hover:text-tomato-700' },
];

const UNIT_LABELS: Record<PantryItem['unit'], string> = {
  PIECE: '×',
  GRAM: 'g',
  MILLILITER: 'mL',
};

interface PantryItemRowProps {
  item: PantryItem;
}

// Une carte de l'inventaire : photo, nom, quantité, date, badge d'urgence et actions.
export function PantryItemRow({ item }: PantryItemRowProps) {
  const urgency = URGENCY_STYLES[item.urgency];
  const queryClient = useQueryClient();

  // useMutation : pour MODIFIER des données (useQuery sert à les LIRE).
  const changeStatus = useMutation({
    mutationFn: (status: PantryItemStatus) => updatePantryItemStatus(item.id, status),
    // Une fois l'API à jour, on déclare la liste périmée : TanStack Query la recharge
    // tout seul, et l'article disparaît de l'inventaire actif.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pantry-items'] }),
  });

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3.5">
        <Thumbnail item={item} colors={urgency.colors} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold tracking-[-0.01em]">{item.name}</p>
          <p className="mt-0.5 text-sm text-ink-600">
            {formatQuantity(item)} · <span className="font-semibold">{item.expiryType}</span> {formatDate(item.expiryDate)}
          </p>
          {/* Badge coloré : l'urgence se lit d'un coup d'œil en parcourant la liste. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${urgency.colors}`}>{urgency.label}</span>
            <span className="text-xs font-semibold text-ink-600">{formatDaysLeft(item.daysLeft)}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={changeStatus.isPending}
            onClick={() => changeStatus.mutate(action.status)}
            // Pour les lecteurs d'écran : "Consommé : Lait" plutôt que trois boutons "Consommé" identiques.
            aria-label={`${action.label} : ${item.name}`}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-mist text-[13px] font-bold text-ink-900 transition disabled:opacity-50 ${action.className}`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {changeStatus.isError && (
        <p role="alert" className="alert-error mt-3">
          L'action n'a pas pu être enregistrée. Réessayez.
        </p>
      )}
    </li>
  );
}

// Photo du produit scanné (servie par Open Food Facts, URL https vérifiée par l'API),
// sinon une pastille avec l'initiale, aux couleurs de l'urgence.
function Thumbnail({ item, colors }: { item: PantryItem; colors: string }) {
  if (item.product?.imageUrl) {
    return (
      <img
        src={item.product.imageUrl}
        alt=""
        loading="lazy"
        className="h-16 w-16 shrink-0 rounded-2xl bg-mist object-contain p-1.5"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black ${colors}`}
    >
      {item.name.charAt(0).toUpperCase()}
    </span>
  );
}

function formatQuantity(item: PantryItem): string {
  return item.unit === 'PIECE' ? `×${item.quantity}` : `${item.quantity} ${UNIT_LABELS[item.unit]}`;
}

// "2026-10-25" → "25 oct. 2026". timeZone UTC : la date est stockée à minuit UTC ; sans cette
// option, un navigateur en avance sur UTC pourrait afficher la veille selon l'heure.
function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < -1) return `Dépassée de ${-daysLeft} jours`;
  if (daysLeft === -1) return 'Dépassée depuis hier';
  if (daysLeft === 0) return "Aujourd'hui";
  if (daysLeft === 1) return 'Demain';
  return `Dans ${daysLeft} jours`;
}
