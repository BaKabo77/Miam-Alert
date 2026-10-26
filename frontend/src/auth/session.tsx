// Tout ce qui concerne la session de l'utilisateur, dans un seul fichier :
// qui est connecté, comment se connecter / s'inscrire / se déconnecter,
// et la protection des pages réservées aux utilisateurs connectés.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';
import { apiRequest, refreshSession, setAccessToken, setSessionExpiredHandler } from '../lib/api';

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  households: { id: string; name: string; role: 'OWNER' | 'MEMBER' }[];
}

// Les 3 états possibles de la session.
type Session =
  | { status: 'loading' } // on ne sait pas encore (vérification en cours)
  | { status: 'anonymous' } // personne n'est connecté
  | { status: 'authenticated'; user: User }; // connecté, et voici qui

interface AuthContextValue {
  session: Session;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (names: ProfileNames) => Promise<User>;
}

// Prénom et nom facultatifs : un champ vide est ignoré par l'API.
export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Un champ vide efface le prénom ou le nom (l'API le transforme en null).
export interface ProfileNames {
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Composant placé tout en haut de l'application (dans main.tsx) : il garde la session
// et la met à disposition de toutes les pages.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' });

  // Au chargement de la page : l'access token n'existe plus (il était en mémoire),
  // on tente de restaurer la session grâce au cookie du refresh token.
  useEffect(() => {
    setSessionExpiredHandler(() => setSession({ status: 'anonymous' }));

    void (async () => {
      try {
        if (!(await refreshSession())) {
          setSession({ status: 'anonymous' });
          return;
        }
        const user = await apiRequest<User>('/me');
        setSession({ status: 'authenticated', user });
      } catch {
        setSession({ status: 'anonymous' });
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await apiRequest<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      retryOnUnauthorized: false,
    });
    setAccessToken(accessToken);
    const user = await apiRequest<User>('/me');
    setSession({ status: 'authenticated', user });
  }

  async function register(data: RegisterData) {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: data,
      retryOnUnauthorized: false,
    });
    // Compte créé : on connecte directement l'utilisateur.
    await login(data.email, data.password);
  }

  async function updateProfile(names: ProfileNames): Promise<User> {
    const user = await apiRequest<User>('/me', { method: 'PATCH', body: names });
    // La session est mise à jour avec la réponse de l'API : l'accueil affiche le nouveau prénom.
    setSession({ status: 'authenticated', user });
    return user;
  }

  async function logout() {
    try {
      // Révocation de la session côté serveur, pas seulement l'oubli du token côté navigateur.
      await apiRequest('/auth/logout', { method: 'POST', retryOnUnauthorized: false });
    } finally {
      setAccessToken(null);
      setSession({ status: 'anonymous' });
    }
  }

  return (
    <AuthContext.Provider value={{ session, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Accès à la session depuis n'importe quelle page : const { session, login } = useAuth();
// (Rangé ici avec son Provider pour tout garder au même endroit ; le linter préfère un fichier
// séparé pour le rechargement à chaud, ce qui n'a pas d'importance ici.)
// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

// Enveloppe les pages réservées aux utilisateurs connectés : renvoie vers /login sinon.
// C'est du confort d'affichage, pas une protection : la vraie barrière reste l'API,
// qui refuse toute requête sans access token valide.
export function RequireAuth() {
  const { session } = useAuth();

  if (session.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center" aria-label="Chargement">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
      </div>
    );
  }
  if (session.status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

// Le foyer de l'utilisateur connecté (la V1 n'en a qu'un). À n'utiliser que dans les pages
// placées sous <RequireAuth>, où l'utilisateur est forcément connecté.
// oxlint-disable-next-line react/only-export-components
export function useHouseholdId(): string {
  const { session } = useAuth();
  const householdId = session.status === 'authenticated' ? session.user.households[0]?.id : undefined;
  if (!householdId) {
    throw new Error('useHouseholdId must be used on a page that requires authentication');
  }
  return householdId;
}

