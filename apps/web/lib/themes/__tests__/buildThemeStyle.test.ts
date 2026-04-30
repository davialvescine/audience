import type { ThemeTokens } from '@audience/shared-types';
import { describe, expect, it } from 'vitest';

import { buildThemeStyle } from '../buildThemeStyle';

const tokens: ThemeTokens = {
  colors: {
    primary: '14 76 94',
    primaryDeep: '10 44 61',
    accent: '245 197 24',
    secondary: '110 69 182',
    ink: '10 37 64',
    paper: '255 255 255',
    surface: '248 250 252',
    success: '16 185 129',
    danger: '239 68 68',
  },
  radius: { sm: '0.375rem', md: '0.75rem', lg: '1.25rem' },
  font: { sans: 'Inter', display: 'Inter' },
};

describe('buildThemeStyle', () => {
  it('emits CSS custom properties for every color token', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--token-primary']).toBe('14 76 94');
    expect(style['--token-accent']).toBe('245 197 24');
    expect(style['--token-danger']).toBe('239 68 68');
  });

  it('emits radius variables', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--radius-md']).toBe('0.75rem');
  });

  it('emits font variables', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--font-sans']).toBe('Inter');
    expect(style['--font-display']).toBe('Inter');
  });

  it('camelCase keys become kebab-case CSS vars', () => {
    const style = buildThemeStyle(tokens);
    expect(style['--token-primary-deep']).toBe('10 44 61');
  });
});
