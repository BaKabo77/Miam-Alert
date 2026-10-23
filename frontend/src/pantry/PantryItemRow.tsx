import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CheckIcon, SnowflakeIcon, TrashIcon } from '../components/icons';
import { type PantryItem, type PantryItemStatus, updatePantryItemStatus } from './pantry-api';

// Un style par niveau d'urgence. Record<…> oblige TypeScript à vérifier qu'aucun niveau
// n'est oublié : si l'API en ajoute un, le code ne compilera plus tant qu'il n'est pas traité ici.
const URGENCY_STYLES: Record<PantryItem['urgency'], { label: string; badge: string; stripe: string }> = {
  EXPIRED: { label: 'Périmé', badge: 'bg-red-100 text-red-700', stripe: 'bg-red-500' },
  PAST_BEST_BEFORE: { label: 'Date dépassée', badge: 'bg-orange-100 text-orange-700', stripe: 'bg-orange-400' },
  URGENT: { label: 'À consommer vite', badge: 'bg-amber-100 text-amber-800', stripe: 'bg-amber-400' },
  SOON: { label: 'Cette semaine', badge: 'bg-yellow-100 text-yellow-800', stripe: 'bg-yellow-300' },
  // Vert pour « tout va bien » : la fraîcheur, distincte du dégradé orange-rouge de l'application.
  OK: { label: 'OK', badge: 'bg-fresh-50 text-fresh-700', stripe: 'bg-fresh-300' },
};

// Les actions proposées sur chaque article : il quitte alors l'inventaire actif.
// (Les statuts consommé / jeté serviront aux statistiques de gaspillage.)
const ACTIONS: { status: PantryItemStatus; label: string; icon: ReactNode; className: string }[] = [
  { status: 'CONSUMED', label: 'Consommé', icon: <CheckIcon className="h-4 w-4" />, className: 'hover:bg-fresh-50 hover:text-fresh-700' },
  { status: 'FROZEN', label: 'Congelé', icon: <SnowflakeIcon className="h-4 w-4" />, className: 'hover:bg-sky-50 hover:text-sky-700' },
  { status: 'WASTED', label: 'Jeté', icon: <TrashIcon className="h-4 w-4" />, className: 'hover:bg-red-50 hover:text-red-700' },
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
    <li className="card relative overflow-hidden p-3 pl-4">
      {/* Liseré de couleur à gauche : l'urgence se lit d'un coup d'œil en parcourant la liste. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${urgency.stripe}`} />

      <div className="flex items-center gap-3">
        <Thumbnail item={item} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">{item.name}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${urgency.badge}`}>
              {urgency.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-500">
            {formatQuantity(item)} · <span className="font-medium">{item.expiryType}</span>{' '}
            {formatDate(item.expiryDate)}
          </p>
          <p className="text-xs text-ink-500">{formatDaysLeft(item.daysLeft)}</p>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-1 border-t border-brand-900/10 pt-2">
        {ACTIONS.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={changeStatus.isPending}
            onClick={() => changeStatus.mutate(action.status)}
            // Pour les lecteurs d'écran : "Consommé : Lait" plutôt que trois boutons "Consommé" identiques.
            aria-label={`${action.label} : ${item.name}`}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 transition disabled:opacity-50 ${action.className}`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {changeStatus.isError && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          L'action n'a pas pu être enregistrée. Réessayez.
        </p>
      )}
    </li>
  );
}

// Photo du produit scanné (servie par Open Food Facts, URL https vérifiée par l'API),
// sinon une pastille avec l'initiale.
function Thumbnail({ item }: { item: PantryItem }) {
  if (item.product?.imageUrl) {
    return (
      <img
        src={item.product.imageUrl}
        alt=""
        loading="lazy"
        className="h-14 w-14 shrink-0 rounded-xl bg-card object-contain ring-1 ring-brand-900/10"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-linear-to-br from-fresh-50 to-fresh-100 text-xl font-bold text-fresh-700"
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
