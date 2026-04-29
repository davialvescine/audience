import type { ThemeTokens } from '@audience/shared-types';

const camelToKebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export function buildThemeStyle(tokens: ThemeTokens): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.colors)) {
    style[`--color-${camelToKebab(key)}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.radius)) {
    style[`--radius-${key}`] = value;
  }
  style['--font-sans'] = tokens.font.sans;
  style['--font-display'] = tokens.font.display;
  return style;
}
