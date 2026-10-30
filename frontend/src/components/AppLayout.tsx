import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/session';
import { initials } from './initials';
import { ListIcon, PotIcon, ScanIcon, UserIcon } from './icons';
import { Logo } from './Logo';

// Cadre commun à toutes les pages de l'application connectée : barre du haut, la page demandée
// à la place de <Outlet />, et barre d'onglets en bas (comme une application mobile).
export function AppLayout() {
  const { session } = useAuth();
  const user = session.status === 'authenticated' ? session.user : null;
  const userInitials = user ? initials(user.firstName, user.lastName) : '';

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Logo />
          {/* Avatar : initiales si un prénom ou un nom est renseigné, sinon une icône. */}
          <NavLink
            to="/profile"
            aria-label="Mon profil"
            title="Mon profil"
            className={({ isActive }) =>
              `grid h-10 w-10 place-items-center rounded-full bg-peach-100 text-sm font-bold text-peach-800 transition hover:ring-2 hover:ring-peach-800/20 ${
                isActive ? 'ring-2 ring-ink-900' : ''
              }`
            }
          >
            {userInitials || <UserIcon />}
          </NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-6">
        <Outlet />
      </main>

      <nav
        aria-label="Navigation principale"
        // safe-area-inset-bottom : laisse la place à la barre de geste des téléphones récents.
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 items-end px-5">
          <TabLink to="/" label="Inventaire" icon={<ListIcon />} />
          {/* Le scan est l'action principale de l'application : bouton central mis en avant. */}
          <NavLink
            to="/scan"
            className="-mt-6 flex flex-col items-center gap-1 pb-2 text-xs font-bold text-ink-900"
          >
            <span className="grid h-15 w-15 place-items-center rounded-full bg-brand text-ink-900 ring-4 ring-white transition hover:bg-brand-hover">
              <ScanIcon className="h-6 w-6" />
            </span>
            Scanner
          </NavLink>
          {/* « Ajouter à la main » est sur l'inventaire et sur la page de scan. */}
          <TabLink to="/recipes" label="Recettes" icon={<PotIcon />} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      // L'inventaire n'est actif que sur « / » ; Recettes l'est aussi sur la fiche d'une recette.
      end={to === '/'}
      // NavLink sait si son lien correspond à la page affichée : on met cet onglet en avant.
      className={({ isActive }) =>
        `group flex flex-col items-center gap-1 py-2.5 text-xs font-bold transition ${
          isActive ? 'text-ink-900' : 'text-ink-600 hover:text-ink-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Pastille derrière l'icône de l'onglet actif. */}
          <span className={`rounded-full px-4 py-1 transition ${isActive ? 'bg-peach-100' : ''}`}>{icon}</span>
          {label}
        </>
      )}
    </NavLink>
  );
}
