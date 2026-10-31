import { useState } from 'react';
import { analyticsEnabled, isOptedOut, setOptedOut } from '../lib/analytics';

// Droit d'opposition à la mesure d'audience, par appareil (l'opposition est enregistrée dans ce
// navigateur, pas dans le compte : la mesure ne connaît pas les comptes).
export function AnalyticsChoice() {
  const [optedOut, setOptedOutState] = useState(isOptedOut);
  const [storageError, setStorageError] = useState(false);

  if (!analyticsEnabled()) {
    return <p>La mesure d'audience n'est pas active sur cette version de l'application.</p>;
  }

  function toggle() {
    const saved = setOptedOut(!optedOut);
    setStorageError(!saved);
    if (saved) {
      setOptedOutState(!optedOut);
    }
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <p role="status" className="font-semibold">
        {optedOut
          ? 'Vos visites ne sont pas mesurées sur cet appareil.'
          : 'Vos visites sont mesurées de façon anonyme sur cet appareil.'}
      </p>
      <button type="button" onClick={toggle} className="btn-secondary mt-3 h-10 px-4 text-sm">
        {optedOut ? 'Réactiver la mesure' : 'Ne plus mesurer mes visites'}
      </button>
      {storageError && (
        <p role="alert" className="alert-warning mt-3">
          Ce navigateur bloque le stockage local : le choix n'a pas pu être enregistré. Le réglage « Ne pas me pister »
          du navigateur est aussi respecté.
        </p>
      )}
    </div>
  );
}
