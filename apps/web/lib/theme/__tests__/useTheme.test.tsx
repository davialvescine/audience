import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTheme, type ThemeMode } from '../useTheme';

function Probe() {
  const { mode, resolved, setMode } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode ?? '(null)'}</span>
      <span data-testid="resolved">{resolved ?? '(null)'}</span>
      <button data-testid="to-light" onClick={() => setMode('light')}>
        light
      </button>
      <button data-testid="to-dark" onClick={() => setMode('dark')}>
        dark
      </button>
      <button data-testid="to-system" onClick={() => setMode('system')}>
        system
      </button>
    </div>
  );
}

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_: 'change', listener: (e: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_: 'change', listener: (e: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', () => mql);
  return { mql, listeners };
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.matchMedia = originalMatchMedia;
  });

  it('defaults to system mode and resolves to light when prefers-color-scheme is light', () => {
    mockMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('system');
    expect(screen.getByTestId('resolved').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('resolves system to dark when prefers-color-scheme is dark', () => {
    mockMatchMedia(true);
    render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('system');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists explicit mode and applies dark class', () => {
    mockMatchMedia(false);
    render(<Probe />);
    act(() => {
      screen.getByTestId('to-dark').click();
    });
    expect(localStorage.getItem('theme')).toBe('dark' satisfies ThemeMode);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
  });

  it('switching to light removes dark class', () => {
    mockMatchMedia(true);
    render(<Probe />);
    act(() => {
      screen.getByTestId('to-light').click();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light' satisfies ThemeMode);
  });

  it('reads saved value from localStorage on mount', () => {
    mockMatchMedia(false);
    localStorage.setItem('theme', 'dark');
    render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
