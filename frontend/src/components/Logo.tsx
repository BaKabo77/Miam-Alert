interface LogoProps {
  size?: 'md' | 'lg';
  // "inverse" : version claire du nom, pour un fond terre cuite (barre du haut).
  variant?: 'default' | 'inverse';
}

// Logo de l'application : le pictogramme (la tomate scannée, la même image que l'icône de la PWA)
// et le nom.
export function Logo({ size = 'md', variant = 'default' }: LogoProps) {
  const mark = size === 'lg' ? 'h-16 w-16' : 'h-10 w-10';
  const text = size === 'lg' ? 'text-2xl' : 'text-lg';
  const inverse = variant === 'inverse';

  return (
    <span className="inline-flex items-center gap-2">
      {/* alt vide : image décorative, le nom de l'application est écrit juste à côté. */}
      <img src="/logo-mark.svg" alt="" className={`${mark} drop-shadow-sm`} />
      <span className={`font-extrabold tracking-tight ${text} ${inverse ? 'text-white' : 'text-ink-900'}`}>
        Miam<span className={inverse ? 'text-amber-200' : 'text-flame'}>'Alert</span>
      </span>
    </span>
  );
}
