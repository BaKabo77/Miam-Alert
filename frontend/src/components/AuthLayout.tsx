import type { ReactNode } from 'react';
import { Logo } from './Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

// Cadre des pages de connexion et d'inscription : fond dégradé et carte centrée.
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh place-items-center bg-linear-to-br from-brand-50 via-surface to-amber-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-ink-500">Le garde-manger qui vous évite de jeter.</p>
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mb-6 text-sm text-ink-500">{subtitle}</p>
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">{footer}</p>
      </div>
    </div>
  );
}
