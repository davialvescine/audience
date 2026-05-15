import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from '../ThemeToggle';

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(prefersDark: boolean) {
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', () => mql);
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.matchMedia = originalMatchMedia;
  });

  it('renders the three theme options after mount', () => {
    mockMatchMedia(false);
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeTruthy();
  });

  it('marks the active mode with aria-checked=true', () => {
    mockMatchMedia(false);
    localStorage.setItem('theme', 'light');
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'Claro' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Escuro' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('clicking dark applies dark class and persists', () => {
    mockMatchMedia(false);
    render(<ThemeToggle />);
    const dark = screen.getByRole('radio', { name: 'Escuro' });
    act(() => dark.click());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
