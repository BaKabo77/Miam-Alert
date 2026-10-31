// Mesure d'audience, auto-hébergée (Umami) et sans cookie : on sait COMMENT l'application est
// utilisée, jamais PAR QUI. Exemptée de consentement par la CNIL tant qu'elle reste dans ces limites :
// - aucun cookie, aucun identifiant persistant ; l'adresse IP n'est pas conservée par Umami ;
// - ni paramètres d'URL ni fragment envoyés (les liens d'email portent un jeton dans le fragment) ;
// - le réglage « Ne pas me pister » du navigateur est respecté ;
// - opposition possible à tout moment, par appareil (politique de confidentialité).
// Désactivée si l'adresse d'Umami ou l'identifiant du site n'est pas fourni à la construction.

const STATS_URL: string = import.meta.env.VITE_STATS_URL ?? '';
const WEBSITE_ID: string = import.meta.env.VITE_STATS_WEBSITE_ID ?? '';

// Clé lue par le script d'Umami lui-même : présente, plus rien n'est envoyé depuis cet appareil.
const OPT_OUT_KEY = 'umami.disabled';

// Les seuls événements mesurés. Liste fermée, SANS donnée associée : impossible d'y glisser un
// email, un nom de produit ou un identifiant, le code ne compilerait pas.
export type AnalyticsEvent = 'signup' | 'product-scanned' | 'item-added' | 'recipe-viewed' | 'recipe-cooked';

declare global {
  interface Window {
    umami?: { track: (event: string) => void };
  }
}

export function analyticsEnabled(): boolean {
  return STATS_URL !== '' && WEBSITE_ID !== '';
}

// Charge le script d'Umami (servi par notre serveur, autorisé par la CSP). Appelé une fois au démarrage.
export function startAnalytics(): void {
  if (!analyticsEnabled()) {
    return;
  }
  const script = document.createElement('script');
  script.defer = true;
  script.src = `${STATS_URL}/script.js`;
  script.dataset.websiteId = WEBSITE_ID;
  script.dataset.doNotTrack = 'true';
  script.dataset.excludeSearch = 'true';
  script.dataset.excludeHash = 'true';
  document.head.appendChild(script);
}

export function trackEvent(event: AnalyticsEvent): void {
  // Sans script (désactivé, bloqué, opposition), rien ne se passe : la mesure n'est jamais nécessaire.
  window.umami?.track(event);
}

// Opposition, par appareil. Le stockage local peut être indisponible (navigation privée stricte) :
// on le signale plutôt que de faire croire que le choix est enregistré.
export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== null;
  } catch {
    return false;
  }
}

export function setOptedOut(optedOut: boolean): boolean {
  try {
    if (optedOut) {
      localStorage.setItem(OPT_OUT_KEY, '1');
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
    }
    return true;
  } catch {
    return false;
  }
}
