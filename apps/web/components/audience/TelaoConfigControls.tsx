'use client';

/**
 * Primitivos compartilhados de UI pra editar `TelaoConfig`. Usados pelo
 * TelaoTab (config global do evento) e pelo CommentsPropsPanel (config do
 * slide `comments`). DRY: mesmo controle de fonte/cor/posição em ambos.
 */

export function Slider({
  label,
  suffix,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
        <span>{label}</span>
        <span className="text-ink font-medium">
          {value}
          {suffix}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">{label}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-10 px-2 rounded-md border border-ink/20 bg-paper text-ink text-xs font-mono"
          placeholder="rgba(...) ou #..."
        />
        <input
          type="color"
          value={cssToHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-md border border-ink/20 cursor-pointer"
        />
      </div>
    </div>
  );
}

export function PresetGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  iconFor,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  iconFor?: (o: T) => string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-3 h-9 rounded-md text-sm border transition inline-flex items-center gap-1.5 ${
              value === o
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-ink/15 text-ink/60 hover:border-ink/30'
            }`}
          >
            {iconFor && (
              <span aria-hidden className="text-base leading-none">
                {iconFor(o)}
              </span>
            )}
            <span>{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Extrai primeiro hex/rgb arbitrário pra alimentar o color picker. */
export function cssToHex(css: string): string {
  if (css.startsWith('#') && (css.length === 7 || css.length === 4)) return css;
  const rgbMatch = css.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${toHex(r!)}${toHex(g!)}${toHex(b!)}`;
  }
  return '#000000';
}
