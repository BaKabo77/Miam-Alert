import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/session';
import { LegalLayout } from '../legal/LegalLayout';
import { apiRequest } from '../lib/api';

// Page ouverte depuis le lien de l'email : /verify-email#token=...
// Publique : le lien peut être ouvert sur un appareil où l'on n'est pas connecté.
export function VerifyEmailPage() {
  const { session, reloadUser } = useAuth();
  const [status, setStatus] = useState<'checking' | 'verified' | 'invalid'>('checking');
  // En développement, React exécute les effets deux fois (StrictMode) : sans ce verrou, le lien,
  // à usage unique, serait envoyé deux fois et la seconde tentative afficherait une erreur.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // Le jeton est retiré aussitôt de la barre d'adresse et de l'historique du navigateur.
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setStatus('invalid');
      return;
    }

    apiRequest('/auth/verify-email', { method: 'POST', body: { token }, retryOnUnauthorized: false })
      .then(() => setStatus('verified'))
      .catch(() => setStatus('invalid'));
  }, []);

  // Une fois vérifié, le profil de la session ouverte est relu pour faire disparaître le bandeau.
  // On attend que la session soit restaurée (elle peut l'être pendant la vérification).
  const needsReload = status === 'verified' && session.status === 'authenticated' && !session.user.emailVerified;
  useEffect(() => {
    if (needsReload) {
      void reloadUser().catch(() => {});
    }
  }, [needsReload, reloadUser]);

  const next = session.status === 'authenticated' ? { to: '/', label: 'Aller à mon inventaire' } : { to: '/login', label: 'Se connecter' };

  return (
    <LegalLayout title="Vérification de l'email" showLastUpdated={false}>
      {status === 'checking' && <p>Vérification en cours…</p>}
      {status === 'verified' && (
        <p role="status" className="alert-success">
          Votre adresse email est confirmée. Merci !
        </p>
      )}
      {status === 'invalid' && (
        <p role="alert" className="alert-error">
          Ce lien n'est pas valable : il a peut-être expiré (24 heures) ou déjà servi. Depuis l'application, vous
          pouvez demander un nouvel email.
        </p>
      )}
      {status !== 'checking' && (
        <Link to={next.to} className="btn-primary w-full">
          {next.label}
        </Link>
      )}
    </LegalLayout>
  );
}
