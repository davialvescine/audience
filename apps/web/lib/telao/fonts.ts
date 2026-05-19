/**
 * Catálogo curado de fontes pro telão. Cada fonte é carregada como CSS
 * variable no layout root (via next/font/google) e referenciada aqui pelo
 * mesmo nome de variável + fallback nativo.
 *
 * `value` é o string usado direto em `style.fontFamily` — sempre via
 * `var(--font-…)` pra o Next conseguir self-host e otimizar.
 */
export type TelaoFontKey =
  | 'inter'
  | 'jakarta'
  | 'montserrat'
  | 'poppins'
  | 'dm-sans'
  | 'space-grotesk'
  | 'playfair'
  | 'lora'
  | 'bebas'
  | 'roboto-slab';

export type TelaoFontOption = {
  key: TelaoFontKey;
  label: string;
  /** Valor pronto pra `style.fontFamily`. */
  value: string;
  /** Categoria pra agrupar no picker. */
  category: 'sans' | 'serif' | 'display';
};

export const TELAO_FONTS: readonly TelaoFontOption[] = [
  {
    key: 'inter',
    label: 'Inter',
    value: 'var(--font-inter), Inter, system-ui, -apple-system, sans-serif',
    category: 'sans',
  },
  {
    key: 'jakarta',
    label: 'Plus Jakarta Sans',
    value: 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif',
    category: 'sans',
  },
  {
    key: 'montserrat',
    label: 'Montserrat',
    value: 'var(--font-montserrat), Montserrat, system-ui, sans-serif',
    category: 'sans',
  },
  {
    key: 'poppins',
    label: 'Poppins',
    value: 'var(--font-poppins), Poppins, system-ui, sans-serif',
    category: 'sans',
  },
  {
    key: 'dm-sans',
    label: 'DM Sans',
    value: 'var(--font-dm-sans), "DM Sans", system-ui, sans-serif',
    category: 'sans',
  },
  {
    key: 'space-grotesk',
    label: 'Space Grotesk',
    value: 'var(--font-space-grotesk), "Space Grotesk", system-ui, sans-serif',
    category: 'sans',
  },
  {
    key: 'playfair',
    label: 'Playfair Display',
    value: 'var(--font-playfair), "Playfair Display", Georgia, serif',
    category: 'serif',
  },
  {
    key: 'lora',
    label: 'Lora',
    value: 'var(--font-lora), Lora, Georgia, serif',
    category: 'serif',
  },
  {
    key: 'roboto-slab',
    label: 'Roboto Slab',
    value: 'var(--font-roboto-slab), "Roboto Slab", Georgia, serif',
    category: 'serif',
  },
  {
    key: 'bebas',
    label: 'Bebas Neue',
    value: 'var(--font-bebas), "Bebas Neue", Impact, sans-serif',
    category: 'display',
  },
];

/** Compatibilidade com configs legadas que persistiram só o label ("Inter").
 *  Mapeia label/key/value pra value final. Se não achar, devolve a string
 *  original (deixa o browser resolver — fallback gracioso). */
export function resolveTelaoFont(input: string | undefined | null): string {
  if (!input) return TELAO_FONTS[0]!.value;
  const trimmed = input.trim();
  const byValue = TELAO_FONTS.find((f) => f.value === trimmed);
  if (byValue) return byValue.value;
  const byKey = TELAO_FONTS.find((f) => f.key === trimmed);
  if (byKey) return byKey.value;
  const byLabel = TELAO_FONTS.find(
    (f) => f.label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byLabel) return byLabel.value;
  return trimmed;
}
