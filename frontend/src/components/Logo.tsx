interface LogoProps {
  size?: 'md' | 'lg';
  // "inverse" : version claire, pour un fond terre cuite (barre du haut).
  variant?: 'default' | 'inverse';
}

// Logo de l'application : le pictogramme (le même que l'icône de la PWA) et le nom.
export function Logo({ size = 'md', variant = 'default' }: LogoProps) {
  const mark = size === 'lg' ? 'h-12 w-12 text-2xl' : 'h-8 w-8 text-base';
  const text = size === 'lg' ? 'text-2xl' : 'text-lg';
  const inverse = variant === 'inverse';

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`grid place-items-center rounded-xl font-extrabold shadow-sm ${mark} ${
          inverse ? 'bg-card text-brand-700' : 'bg-flame-bright text-white'
        }`}
      >
        M
      </span>
      <span className={`font-extrabold tracking-tight ${text} ${inverse ? 'text-white' : 'text-ink-900'}`}>
        Miam<span className={inverse ? 'text-amber-200' : 'text-flame'}>'Alert</span>
      </span>
    </span>
  );
}
