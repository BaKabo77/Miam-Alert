// Client HTTP unique de l'application : tous les appels à l'API passent par ici.

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Erreur renvoyée par l'API, avec son code HTTP (400, 401, 404, 409, 429...).
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// L'access token vit UNIQUEMENT en mémoire (une variable du module) : ni localStorage,
// ni sessionStorage, que n'importe quel script de la page pourrait lire en cas de faille XSS.
// Il est perdu au rechargement de la page : la session est alors restaurée par refreshSession().
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Appelé quand la session ne peut pas être renouvelée (refresh token expiré ou révoqué).
let onSessionExpired: () => void = () => {};

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// Un seul renouvellement à la fois. Si deux requêtes reçoivent un 401 en même temps, elles
// attendent le même refresh : deux refresh simultanés présenteraient le même refresh token,
// et l'API y verrait une réutilisation (vol probable) et couperait toute la session.
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      // Le cookie httpOnly du refresh token est joint par le navigateur (credentials: 'include') :
      // le code JavaScript ne le voit jamais.
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        accessToken = null;
        return false;
      }
      const body = (await response.json()) as { accessToken: string };
      accessToken = body.accessToken;
      return true;
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  // false pour les routes /auth/* : un 401 au login signifie "mauvais identifiants",
  // pas "token expiré", il ne faut donc pas tenter de renouveler la session.
  retryOnUnauthorized?: boolean;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retryOnUnauthorized = true } = options;

  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await send();

  // Access token expiré (15 min) : on le renouvelle une fois, puis on rejoue la requête.
  if (response.status === 401 && retryOnUnauthorized) {
    if (await refreshSession()) {
      response = await send();
    } else {
      onSessionExpired();
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === 'string' ? body.message : response.statusText;
  } catch {
    return response.statusText;
  }
}
