import { useState } from 'react';
import { DownloadIcon } from '../components/icons';
import { ApiError, apiRequest } from '../lib/api';

// Droit d'accès et de portabilité (RGPD) : toutes les données du compte en un fichier JSON.
export function DataExportSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'throttled'>('idle');

  async function download() {
    setStatus('loading');
    try {
      // Passe par le client HTTP pour joindre l'access token (gardé en mémoire, jamais dans une URL).
      const data = await apiRequest<{ exportedAt: string }>('/me/export');
      saveAsFile(JSON.stringify(data, null, 2), `miam-alert-export-${data.exportedAt.slice(0, 10)}.json`);
      setStatus('idle');
    } catch (caught) {
      setStatus(caught instanceof ApiError && caught.status === 429 ? 'throttled' : 'error');
    }
  }

  return (
    <div>
      <h2 className="text-lg font-extrabold">Mes données</h2>
      <p className="mt-1 mb-4 text-sm text-ink-600">
        Téléchargez tout ce que Miam'Alert conserve sur vous (profil, inventaire, alertes, sessions), dans un
        fichier lisible et réutilisable ailleurs.
      </p>
      <button type="button" onClick={() => void download()} disabled={status === 'loading'} className="btn-secondary w-full">
        <DownloadIcon className="h-4 w-4" /> {status === 'loading' ? 'Préparation…' : 'Télécharger mes données'}
      </button>
      {status === 'error' && (
        <p role="alert" className="alert-error mt-3">
          Le téléchargement n'a pas pu aboutir. Réessayez.
        </p>
      )}
      {status === 'throttled' && (
        <p role="alert" className="alert-warning mt-3">
          Trop de téléchargements en peu de temps. Réessayez dans une minute.
        </p>
      )}
    </div>
  );
}

// Fichier créé dans le navigateur à partir de la réponse, puis téléchargé : les données ne
// passent par aucun autre serveur. L'adresse temporaire est libérée juste après.
function saveAsFile(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
