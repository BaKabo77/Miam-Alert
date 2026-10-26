import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, CloseIcon } from '../components/icons';
import { type Alert, fetchTodayAlert, markAlertAsRead } from './alerts-api';

// Bandeau de l'alerte du jour, en haut de l'inventaire. Invisible s'il n'y a pas d'alerte,
// ou si elle a déjà été fermée (sur cet appareil ou un autre : l'état est stocké par l'API).
export function AlertBanner({ householdId }: { householdId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['today-alert', householdId];

  const { data: alert } = useQuery({
    queryKey,
    queryFn: () => fetchTodayAlert(householdId),
  });

  const dismiss = useMutation({
    mutationFn: (alertId: string) => markAlertAsRead(alertId),
    // Mise à jour « optimiste » : le bandeau disparaît tout de suite, sans attendre l'API...
    onMutate: () => {
      queryClient.setQueryData<Alert | null>(queryKey, (current) => (current ? { ...current, read: true } : current));
    },
    // ...et si l'API refuse, on relit l'état réel : le bandeau réapparaît.
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (!alert || alert.read) {
    return null;
  }

  return (
    // Bloc noir avec une pastille orange : le seul élément sombre de la page, il attire l'œil.
    <section aria-label="Alerte du jour" className="mb-6 flex items-start gap-3.5 rounded-3xl bg-ink-900 p-4 text-white">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-ink-900">
        <BellIcon />
      </span>
      <div className="flex-1">
        {/* "Ce matin" : les compteurs datent du calcul de 9 h, la liste ci-dessous est à jour. */}
        <p className="text-xs font-bold tracking-wide text-brand uppercase">Alerte de ce matin</p>
        <p className="mt-0.5 text-[17px] font-bold">{alertMessage(alert)}</p>
        <p className="mt-0.5 text-sm text-white/75">Commencez par le haut de votre inventaire.</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss.mutate(alert.id)}
        aria-label="Fermer l'alerte"
        title="Fermer l'alerte"
        className="-mt-1 -mr-1 rounded-full p-1.5 text-white/75 transition hover:bg-white/10 hover:text-white"
      >
        <CloseIcon />
      </button>
    </section>
  );
}

// "1 produit périmé, 2 à consommer vite" : seules les parties non nulles, avec les bons pluriels.
function alertMessage({ expiredCount, urgentCount }: Alert): string {
  const parts: string[] = [];
  if (expiredCount > 0) {
    parts.push(`${expiredCount} produit${expiredCount > 1 ? 's' : ''} périmé${expiredCount > 1 ? 's' : ''}`);
  }
  if (urgentCount > 0) {
    parts.push(`${urgentCount} à consommer vite`);
  }
  return parts.join(', ');
}
