import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ThemeProvider } from '../ThemeProvider';

const tokens = {
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

describe('ThemeProvider', () => {
  it('injects CSS variables on its container', () => {
    const { container } = render(
      <ThemeProvider tokens={tokens}>
        <span>hi</span>
      </ThemeProvider>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue('--token-primary')).toBe('14 76 94');
    expect(root.style.getPropertyValue('--radius-md')).toBe('0.75rem');
  });
});
