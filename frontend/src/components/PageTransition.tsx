import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

// Position de chaque page de gauche à droite, dans l'ordre des onglets du bas. Une page de détail
// se place juste après son onglet (la fiche d'une recette « après » les idées de recettes) : on y
// entre par la droite, on en revient par la gauche.
function rank(pathname: string): number {
  if (pathname === '/') return 0;
  if (pathname === '/add') return 0.5;
  if (pathname === '/scan') return 1;
  if (pathname === '/recipes') return 2;
  if (pathname.startsWith('/recipes/')) return 2.5;
  if (pathname === '/household') return 3;
  if (pathname === '/join') return 3.5;
  if (pathname === '/profile') return 4;
  return -1;
}

const ANIMATION = {
  right: 'motion-safe:animate-page-from-right',
  left: 'motion-safe:animate-page-from-left',
  fade: 'motion-safe:animate-page-fade',
};

// Rejoue une courte animation d'entrée à chaque changement de page. La clé (le chemin) recrée le
// conteneur, ce qui relance l'animation CSS ; le sens dépend de la position des deux pages.
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [current, setCurrent] = useState({ pathname, direction: 'fade' as keyof typeof ANIMATION });

  // Ajustement d'état pendant le rendu quand la page change (motif recommandé par React plutôt
  // qu'un effet, qui afficherait d'abord la page sans animation).
  if (current.pathname !== pathname) {
    const from = rank(current.pathname);
    const to = rank(pathname);
    const direction = from < 0 || to < 0 || from === to ? 'fade' : to > from ? 'right' : 'left';
    setCurrent({ pathname, direction });
  }

  return (
    <div key={current.pathname} className={ANIMATION[current.direction]}>
      {children}
    </div>
  );
}
