interface LogoProps {
  size?: 'md' | 'lg';
}

// Logo de l'application : le pictogramme (la tomate scannée, la même image que l'icône de la PWA)
// et le nom. L'orange de « 'Alert » est décoratif : un logotype n'est pas soumis aux règles de contraste.
export function Logo({ size = 'md' }: LogoProps) {
  const mark = size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  const text = size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <span className="inline-flex items-center gap-2">
      {/* alt vide : image décorative, le nom de l'application est écrit juste à côté. */}
      <img src="/logo-mark.svg" alt="" className={mark} />
      <span className={`font-black tracking-[-0.02em] text-ink-900 ${text}`}>
        Miam<span className="text-brand">'Alert</span>
      </span>
    </span>
  );
}
