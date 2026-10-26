import type { ReactNode } from 'react';
import { Logo } from './Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

// Ce que fait l'application, en trois pastilles colorées sous l'accroche.
const HIGHLIGHTS = [
  { label: 'Scan des courses', className: 'bg-white/70 text-peach-800' },
  { label: 'Alerte chaque matin', className: 'bg-white/70 text-tomato-700' },
  { label: 'DLC et DDM', className: 'bg-white/70 text-mint-800' },
];

// Cadre des pages de connexion et d'inscription : page blanche, accroche dans un bloc coloré,
// puis le formulaire à plat.
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-sm px-5 py-8">
        <Logo />

        <div className="mt-6 rounded-3xl bg-peach-100 p-5">
          <p className="text-[22px] leading-tight font-extrabold tracking-[-0.03em]">
            Le garde-manger qui vous évite de jeter.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight.label} className={`rounded-full px-3 py-1 text-xs font-bold ${highlight.className}`}>
                {highlight.label}
              </li>
            ))}
          </ul>
        </div>

        <h1 className="page-title mt-8">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>

        <div className="mt-6">{children}</div>

        <p className="mt-8 text-center text-[15px] text-ink-600">{footer}</p>
      </div>
    </div>
  );
}
