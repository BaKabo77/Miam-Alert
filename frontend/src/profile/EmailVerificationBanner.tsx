import { useState } from 'react';
import { useAuth } from '../auth/session';
import { ApiError, apiRequest } from '../lib/api';

// Rappel tant que l'adresse email n'est pas confirmée, avec un bouton pour renvoyer le lien.
export function EmailVerificationBanner() {
  const { session } = useAuth();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (session.status !== 'authenticated' || session.user.emailVerified) {
    return null;
  }

  async function resend() {
    setStatus('sending');
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST' });
      setStatus('sent');
    } catch (caught) {
      setStatus(caught instanceof ApiError && caught.status === 429 ? 'sent' : 'error');
    }
  }

  return (
    <section aria-label="Adresse email à confirmer" className="mb-6 rounded-3xl bg-sun-100 p-4">
      <p className="font-bold text-sun-800">Confirmez votre adresse email</p>
      <p className="mt-1 text-sm">
        Un lien a été envoyé à <span className="font-semibold break-all">{session.user.email}</span>. Ce lien confirme
        que l'adresse vous appartient.
      </p>
      {status === 'sent' ? (
        <p role="status" className="mt-3 text-sm font-semibold text-sun-800">
          Email renvoyé. Pensez à regarder dans les courriers indésirables.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={status === 'sending'}
          className="mt-3 text-sm font-bold underline underline-offset-4"
        >
          {status === 'sending' ? 'Envoi…' : "Renvoyer l'email"}
        </button>
      )}
      {status === 'error' && (
        <p role="alert" className="mt-2 text-sm text-tomato-700">
          L'envoi n'a pas pu aboutir. Réessayez dans quelques minutes.
        </p>
      )}
    </section>
  );
}
