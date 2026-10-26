import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/session';
import { initials } from './initials';
import { ListIcon, PlusIcon, ScanIcon, UserIcon } from './icons';
import { Logo } from './Logo';

// Cadre commun à toutes les pages de l'application connectée : barre du haut, la page demandée
// à la place de <Outlet />, et barre d'onglets en bas (comme une application mobile).
export function AppLayout() {
  const { session } = useAuth();
  const user = session.status === 'authenticated' ? session.user : null;
  const userInitials = user ? initials(user.firstName, user.lastName) : '';

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-10 bg-flame shadow-md shadow-hot-700/20">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Logo variant="inverse" />
          {/* Avatar : initiales si un prénom ou un nom est renseigné, sinon une icône. */}
          <NavLink
            to="/profile"
            aria-label="Mon profil"
            title="Mon profil"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/30 transition hover:bg-white/25"
          >
            {userInitials || <UserIcon />}
          </NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        <Outlet />
      </main>

      <nav
        aria-label="Navigation principale"
        // safe-area-inset-bottom : laisse la place à la barre de geste des téléphones récents.
        className="fixed inset-x-0 bottom-0 z-10 border-t border-brand-900/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 items-end px-4">
          <TabLink to="/" label="Inventaire" icon={<ListIcon />} />
          {/* Le scan est l'action principale de l'application : bouton central mis en avant. */}
          <NavLink
            to="/scan"
            className="-mt-5 flex flex-col items-center gap-1 pb-2 text-xs font-semibold text-brand-700"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-flame-bright text-white shadow-lg shadow-hot-600/30 ring-4 ring-card">
              <ScanIcon className="h-6 w-6" />
            </span>
            Scanner
          </NavLink>
          <TabLink to="/add" label="Ajouter" icon={<PlusIcon />} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      // NavLink sait si son lien correspond à la page affichée : on met cet onglet en avant.
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition ${
          isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-900'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
