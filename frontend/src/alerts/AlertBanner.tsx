import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    <section
      aria-label="Alerte du jour"
      className="bg-flame mb-5 flex items-start gap-3 rounded-2xl p-4 text-white shadow-md shadow-hot-600/25"
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        ⚠️
      </span>
      <div className="flex-1">
        {/* "Ce matin" : les compteurs datent du calcul de 9 h, la liste ci-dessous est à jour. */}
        <p className="text-xs font-semibold uppercase tracking-wide text-white/85">Alerte de ce matin</p>
        <p className="font-semibold">{alertMessage(alert)}</p>
        <p className="mt-0.5 text-sm text-white/90">Commencez par le haut de votre inventaire.</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss.mutate(alert.id)}
        aria-label="Fermer l'alerte"
        title="Fermer l'alerte"
        className="-mr-1 -mt-1 rounded-full p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
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
