import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type PantryItem, type PantryItemStatus, updatePantryItemStatus } from './pantry-api';

// Un style par niveau d'urgence. Record<…> oblige TypeScript à vérifier qu'aucun niveau
// n'est oublié : si l'API en ajoute un, le code ne compilera plus tant qu'il n'est pas traité ici.
const URGENCY_STYLES: Record<PantryItem['urgency'], { label: string; className: string }> = {
  EXPIRED: { label: 'Périmé', className: 'bg-red-100 text-red-800' },
  PAST_BEST_BEFORE: { label: 'Date dépassée', className: 'bg-orange-100 text-orange-800' },
  URGENT: { label: 'À consommer vite', className: 'bg-amber-100 text-amber-800' },
  SOON: { label: 'Cette semaine', className: 'bg-yellow-50 text-yellow-800' },
  OK: { label: 'OK', className: 'bg-green-50 text-green-800' },
};

// Les actions proposées sur chaque article : il quitte alors l'inventaire actif.
// (Les statuts consommé / jeté serviront aux statistiques de gaspillage.)
const ACTIONS: { status: PantryItemStatus; label: string }[] = [
  { status: 'CONSUMED', label: 'Consommé' },
  { status: 'WASTED', label: 'Jeté' },
  { status: 'FROZEN', label: 'Congelé' },
];

const UNIT_LABELS: Record<PantryItem['unit'], string> = {
  PIECE: '×',
  GRAM: 'g',
  MILLILITER: 'mL',
};

interface PantryItemRowProps {
  item: PantryItem;
}

// Une ligne de l'inventaire : nom, quantité, date, badge d'urgence et actions.
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
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-gray-600">
            {formatQuantity(item)} · {item.expiryType} {formatDate(item.expiryDate)} ({formatDaysLeft(item.daysLeft)})
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${urgency.className}`}>
          {urgency.label}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={changeStatus.isPending}
            onClick={() => changeStatus.mutate(action.status)}
            // Pour les lecteurs d'écran : "Consommé : Lait" plutôt que trois boutons "Consommé" identiques.
            aria-label={`${action.label} : ${item.name}`}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {changeStatus.isError && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          L'action n'a pas pu être enregistrée. Réessayez.
        </p>
      )}
    </li>
  );
}

function formatQuantity(item: PantryItem): string {
  return item.unit === 'PIECE' ? `×${item.quantity}` : `${item.quantity} ${UNIT_LABELS[item.unit]}`;
}

// "2026-10-25" → "25/10/2026". timeZone UTC : la date est stockée à minuit UTC ; sans cette
// option, un navigateur en avance sur UTC pourrait afficher la veille selon l'heure.
function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < -1) return `dépassée de ${-daysLeft} jours`;
  if (daysLeft === -1) return 'dépassée depuis hier';
  if (daysLeft === 0) return "aujourd'hui";
  if (daysLeft === 1) return 'demain';
  return `dans ${daysLeft} jours`;
}
