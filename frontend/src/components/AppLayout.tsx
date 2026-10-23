import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/session';

const LINKS = [
  { to: '/', label: 'Inventaire' },
  { to: '/add', label: 'Ajouter' },
  { to: '/scan', label: 'Scanner' },
];

// Cadre commun à toutes les pages de l'application connectée : barre de navigation en haut,
// et la page demandée à la place de <Outlet />.
export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <span className="text-lg font-bold text-green-700">Miam'Alert</span>
          <button type="button" onClick={() => void logout()} className="text-sm text-gray-600 underline">
            Se déconnecter
          </button>
        </div>
        <nav className="mx-auto flex max-w-md gap-1 px-4 pb-2">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              // NavLink sait si son lien correspond à la page affichée : on met ce lien en avant.
              className={({ isActive }) =>
                `rounded px-3 py-1 text-sm ${isActive ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-md p-4">
        <Outlet />
      </main>
    </div>
  );
}
