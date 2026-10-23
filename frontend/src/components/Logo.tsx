// Logo de l'application : le pictogramme (le même que l'icône de la PWA) et le nom.
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const mark = size === 'lg' ? 'h-12 w-12 text-2xl' : 'h-8 w-8 text-base';
  const text = size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`grid place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 font-extrabold text-white shadow-sm ${mark}`}
      >
        M
      </span>
      <span className={`font-extrabold tracking-tight text-ink-900 ${text}`}>
        Miam<span className="text-brand-600">'Alert</span>
      </span>
    </span>
  );
}
