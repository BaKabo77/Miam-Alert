import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { LEGAL_LAST_UPDATED } from './publisher';

interface LegalLayoutProps {
  title: string;
  children: ReactNode;
}

// Cadre des pages légales : accessibles sans être connecté (obligation légale), en texte simple.
export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" aria-label="Miam'Alert, retour à l'application">
            <Logo />
          </Link>
          <Link to="/" className="text-sm font-bold underline underline-offset-4 hover:text-peach-800">
            Retour
          </Link>
        </div>

        <h1 className="page-title mt-10">{title}</h1>
        <p className="page-subtitle">Dernière mise à jour : {LEGAL_LAST_UPDATED}</p>

        <div className="mt-8 space-y-10 text-[15px] leading-relaxed text-ink-900">{children}</div>

        <LegalLinks className="mt-14 border-t border-line pt-6" />
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-extrabold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

// Lien externe : nouvel onglet, sans donner à la page ouverte l'accès à la nôtre (noopener).
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
      {children}
    </a>
  );
}

// Liens vers les deux pages légales, affichés en bas des pages de connexion, du profil et des pages légales.
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`flex justify-center gap-5 text-sm text-ink-600 ${className}`}>
      <Link to="/legal" className="underline underline-offset-4 hover:text-ink-900">
        Mentions légales
      </Link>
      <Link to="/privacy" className="underline underline-offset-4 hover:text-ink-900">
        Confidentialité
      </Link>
    </p>
  );
}
