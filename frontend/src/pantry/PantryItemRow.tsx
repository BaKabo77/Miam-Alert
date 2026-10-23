import type { PantryItem } from './pantry-api';

// Un style par niveau d'urgence. Record<…> oblige TypeScript à vérifier qu'aucun niveau
// n'est oublié : si l'API en ajoute un, le code ne compilera plus tant qu'il n'est pas traité ici.
const URGENCY_STYLES: Record<PantryItem['urgency'], { label: string; className: string }> = {
  EXPIRED: { label: 'Périmé', className: 'bg-red-100 text-red-800' },
  PAST_BEST_BEFORE: { label: 'Date dépassée', className: 'bg-orange-100 text-orange-800' },
  URGENT: { label: 'À consommer vite', className: 'bg-amber-100 text-amber-800' },
  SOON: { label: 'Cette semaine', className: 'bg-yellow-50 text-yellow-800' },
  OK: { label: 'OK', className: 'bg-green-50 text-green-800' },
};

const UNIT_LABELS: Record<PantryItem['unit'], string> = {
  PIECE: '×',
  GRAM: 'g',
  MILLILITER: 'mL',
};

interface PantryItemRowProps {
  item: PantryItem;
}

// Une ligne de l'inventaire : nom, quantité, date et badge d'urgence.
export function PantryItemRow({ item }: PantryItemRowProps) {
  const urgency = URGENCY_STYLES[item.urgency];

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-gray-600">
          {formatQuantity(item)} · {item.expiryType} {formatDate(item.expiryDate)} ({formatDaysLeft(item.daysLeft)})
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${urgency.className}`}>
        {urgency.label}
      </span>
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
