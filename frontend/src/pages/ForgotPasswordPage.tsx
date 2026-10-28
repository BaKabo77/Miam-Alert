import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AuthLayout } from '../components/AuthLayout';
import { ApiError, apiRequest } from '../lib/api';

export function ForgotPasswordPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'throttled'>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email'));
    setStatus('sending');
    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, retryOnUnauthorized: false });
      setStatus('sent');
    } catch (caught) {
      setStatus(caught instanceof ApiError && caught.status === 429 ? 'throttled' : 'error');
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Recevez un lien pour en choisir un nouveau."
      footer={
        <Link to="/login" className="font-bold text-ink-900 underline underline-offset-4 hover:text-peach-800">
          Retour à la connexion
        </Link>
      }
    >
      {status === 'sent' ? (
        // Même message que l'adresse ait un compte ou non : l'API ne le dit pas, l'interface non plus.
        <p role="status" className="alert-success">
          Si un compte existe pour cette adresse, un email vient de lui être envoyé. Le lien est valable 30 minutes ;
          pensez à regarder dans les courriers indésirables.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="label">Email du compte</span>
            <input name="email" type="email" required maxLength={254} autoComplete="email" className="input" />
          </label>
          {status === 'error' && (
            <p role="alert" className="alert-error">
              La demande n'a pas pu aboutir. Réessayez.
            </p>
          )}
          {status === 'throttled' && (
            <p role="alert" className="alert-warning">
              Trop de demandes. Réessayez dans une minute.
            </p>
          )}
          <button type="submit" disabled={status === 'sending'} className="btn-primary w-full">
            {status === 'sending' ? 'Envoi…' : 'Recevoir le lien'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
