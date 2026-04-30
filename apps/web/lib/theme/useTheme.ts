'use client';

import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode): void {
  const resolved = mode === 'system' ? getSystemPreference() : mode;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useTheme(): {
  mode: ThemeMode | null;
  resolved: 'light' | 'dark' | null;
  setMode: (mode: ThemeMode) => void;
} {
  const [mode, setModeState] = useState<ThemeMode | null>(null);
  const [resolved, setResolved] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system';
    setModeState(saved);
    const r = saved === 'system' ? getSystemPreference() : saved;
    setResolved(r);
    applyTheme(saved);

    if (saved === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        const next = getSystemPreference();
        setResolved(next);
        document.documentElement.classList.toggle('dark', next === 'dark');
      };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
    const r = m === 'system' ? getSystemPreference() : m;
    setResolved(r);
    applyTheme(m);
  };

  return { mode, resolved, setMode };
}
