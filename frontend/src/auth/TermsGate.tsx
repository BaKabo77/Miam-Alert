import { useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { LegalLinks } from '../legal/LegalLayout';
import { TERMS_DATE_LABEL, TERMS_VERSION } from '../legal/terms';
import { ApiError, apiRequest } from '../lib/api';
import { DeleteAccountSection } from '../profile/DeleteAccountSection';
import { useAuth } from './session';

// Affiché à la place de l'application quand les CGU ont changé depuis la dernière acceptation
// (l'API le dit dans /me : termsAccepted). C'est l'API qui enregistre l'acceptation et vérifie la
// version ; cet écran n'est que l'étape d'interface.
export function TermsGate() {
  const { reloadUser, logout } = useAuth();
  const [status, setStatus] = useState<'idle' | 'saving' | 'outdated' | 'error'>('idle');

  async function accept() {
    setStatus('saving');
    try {
      await apiRequest('/me/terms-acceptance', { method: 'POST', body: { version: TERMS_VERSION } });
      await reloadUser();
    } catch (caught) {
      // 400 : cette version de l'application affiche d'anciennes CGU (mise à jour en attente).
      setStatus(caught instanceof ApiError && caught.status === 400 ? 'outdated' : 'error');
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-sm px-5 py-8">
        <Logo />
        <h1 className="page-title mt-8">Nouvelles conditions d'utilisation</h1>
        <p className="page-subtitle">Version du {TERMS_DATE_LABEL}.</p>

        <p className="mt-6 text-[15px]">
          Pour continuer à utiliser Miam'Alert, prenez connaissance des{' '}
          <Link to="/terms" target="_blank" className="font-semibold underline underline-offset-4">
            conditions générales d'utilisation
          </Link>{' '}
          puis acceptez-les.
        </p>

        {status === 'outdated' && (
          <p role="alert" className="alert-warning mt-4">
            Une nouvelle version de l'application est disponible : rechargez la page pour afficher les conditions à jour.
          </p>
        )}
        {status === 'error' && (
          <p role="alert" className="alert-error mt-4">
            L'acceptation n'a pas pu être enregistrée. Réessayez.
          </p>
        )}

        <button type="button" onClick={() => void accept()} disabled={status === 'saving'} className="btn-primary mt-6 w-full">
          {status === 'saving' ? 'Enregistrement…' : "J'accepte les conditions"}
        </button>
        <button type="button" onClick={() => void logout()} className="btn-secondary mt-3 w-full">
          Se déconnecter
        </button>

        {/* Refuser les nouvelles conditions ne doit pas obliger à les accepter pour partir : la suppression
            du compte reste possible ici. */}
        <div className="mt-8 border-t border-line pt-6">
          <p className="mb-3 text-sm text-ink-600">Vous ne souhaitez pas les accepter ?</p>
          <DeleteAccountSection />
        </div>

        <LegalLinks className="mt-10" />
      </div>
    </div>
  );
}
