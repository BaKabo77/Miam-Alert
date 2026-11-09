// Tout ce qui concerne la session de l'utilisateur, dans un seul fichier :
// qui est connecté, comment se connecter / s'inscrire / se déconnecter,
// et la protection des pages réservées aux utilisateurs connectés.

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { apiRequest, refreshSession, setAccessToken, setSessionExpiredHandler } from '../lib/api';
import { LandingPage } from '../pages/LandingPage';
import { TermsGate } from './TermsGate';

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  // false : les CGU ont changé depuis la dernière acceptation (décidé par l'API) ; voir TermsGate.
  termsAccepted: boolean;
  households: { id: string; name: string; role: 'OWNER' | 'MEMBER'; ownerName: string | null }[];
}

// Les 3 états possibles de la session.
type Session =
  | { status: 'loading' } // on ne sait pas encore (vérification en cours)
  // personne n'est connecté ; accountDeleted : juste après une suppression de compte (message de confirmation)
  | { status: 'anonymous'; accountDeleted?: boolean }
  | { status: 'authenticated'; user: User }; // connecté, et voici qui

interface AuthContextValue {
  session: Session;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (names: ProfileNames) => Promise<User>;
  deleteAccount: (password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  reloadUser: () => Promise<void>;
  // Foyer affiché (un utilisateur peut appartenir à plusieurs foyers).
  selectedHouseholdId: string | null;
  selectHousehold: (householdId: string) => void;
}

// Foyer choisi, retenu sur cet appareil : un simple identifiant, sans donnée personnelle. Le stockage
// peut être indisponible (navigation privée) : l'application revient alors au premier foyer.
const SELECTED_HOUSEHOLD_KEY = 'miam.household';

function readSelectedHousehold(): string | null {
  try {
    return localStorage.getItem(SELECTED_HOUSEHOLD_KEY);
  } catch {
    return null;
  }
}

function storeSelectedHousehold(householdId: string | null): void {
  try {
    if (householdId === null) {
      localStorage.removeItem(SELECTED_HOUSEHOLD_KEY);
    } else {
      localStorage.setItem(SELECTED_HOUSEHOLD_KEY, householdId);
    }
  } catch {
    // Choix non retenu : sans conséquence.
  }
}

// Prénom et nom facultatifs : un champ vide est ignoré par l'API.
export interface RegisterData {
  email: string;
  password: string;
  // Version des CGU affichée et acceptée (la case est obligatoire) ; l'API refuse toute autre version.
  termsVersion: string;
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
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(readSelectedHousehold);
  const queryClient = useQueryClient();

  function selectHousehold(householdId: string) {
    setSelectedHouseholdId(householdId);
    storeSelectedHousehold(householdId);
  }

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

  // Fin de session côté navigateur : token oublié ET données en cache effacées. Sans clear(),
  // l'inventaire du compte précédent resterait en mémoire pour la personne qui se connecte ensuite.
  function endSession(accountDeleted = false) {
    setAccessToken(null);
    queryClient.clear();
    // Le foyer choisi ne doit pas s'imposer au compte qui se connecte ensuite sur cet appareil.
    setSelectedHouseholdId(null);
    storeSelectedHousehold(null);
    setSession({ status: 'anonymous', accountDeleted });
  }

  async function logout() {
    try {
      // Révocation de la session côté serveur, pas seulement l'oubli du token côté navigateur.
      await apiRequest('/auth/logout', { method: 'POST', retryOnUnauthorized: false });
    } finally {
      endSession();
    }
  }

  // Relit le profil (après la vérification de l'email, par exemple) si une session est ouverte.
  async function reloadUser() {
    if (session.status !== 'authenticated') {
      return;
    }
    const user = await apiRequest<User>('/me');
    setSession({ status: 'authenticated', user });
  }

  // Les autres sessions sont révoquées par l'API ; celle-ci reçoit un nouvel access token (et un
  // nouveau cookie de refresh, posé par l'API) : l'utilisateur reste connecté sur cet appareil.
  async function changePassword(currentPassword: string, newPassword: string) {
    const { accessToken } = await apiRequest<{ accessToken: string }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    setAccessToken(accessToken);
  }

  // Suppression définitive du compte. En cas d'erreur (mauvais mot de passe : 403), rien ne change.
  async function deleteAccount(password: string) {
    await apiRequest('/me', { method: 'DELETE', body: { password } });
    // La page protégée redirige alors vers la connexion, qui lit accountDeleted pour confirmer.
    endSession(true);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        login,
        register,
        logout,
        updateProfile,
        deleteAccount,
        changePassword,
        reloadUser,
        selectedHouseholdId,
        selectHousehold,
      }}
    >
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
  const location = useLocation();

  if (session.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center" aria-label="Chargement">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-mist border-t-brand" />
      </div>
    );
  }
  // Visiteur sans session sur l'accueil : la page de présentation, plutôt qu'un renvoi vers la
  // connexion. Elle est statique (aucun appel à l'API).
  if (session.status === 'anonymous' && location.pathname === '/') {
    return <LandingPage />;
  }
  if (session.status === 'anonymous') {
    // La page demandée est gardée (état de l'historique, pas l'URL) pour y revenir après la connexion :
    // un lien d'invitation ouvert sans être connecté n'est pas perdu.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // CGU modifiées depuis la dernière acceptation : on les fait accepter avant tout le reste.
  if (!session.user.termsAccepted) {
    return <TermsGate />;
  }
  return <Outlet />;
}

// Le foyer affiché : celui choisi s'il fait toujours partie des foyers du compte (on a pu le quitter
// ou en être retiré), sinon le premier (celui créé à l'inscription). À n'utiliser que dans les pages
// placées sous <RequireAuth>, où l'utilisateur est forcément connecté.
// oxlint-disable-next-line react/only-export-components
export function useCurrentHousehold(): User['households'][number] {
  const { session, selectedHouseholdId } = useAuth();
  const households = session.status === 'authenticated' ? session.user.households : [];
  const household = households.find(({ id }) => id === selectedHouseholdId) ?? households[0];
  if (!household) {
    throw new Error('useCurrentHousehold must be used on a page that requires authentication');
  }
  return household;
}

// oxlint-disable-next-line react/only-export-components
export function useHouseholdId(): string {
  return useCurrentHousehold().id;
}

// Où aller après la connexion : la page demandée avant (voir RequireAuth), sinon l'accueil.
// Seul un chemin interne est accepté ; « //site.example » serait une adresse externe.
// oxlint-disable-next-line react/only-export-components
export function returnPath(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; hash?: unknown } } | null)?.from;
  if (typeof from?.pathname !== 'string' || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) {
    return '/';
  }
  return from.pathname + (typeof from.hash === 'string' ? from.hash : '');
}

