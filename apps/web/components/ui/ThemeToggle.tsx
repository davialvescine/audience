'use client';

import type { ReactNode } from 'react';

import { useTheme, type ThemeMode } from '@/lib/theme/useTheme';

const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
  {
    value: 'light',
    label: 'Claro',
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'Sistema',
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path strokeLinecap="round" d="M8 22h8M12 18v4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Escuro',
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  if (mode === null) {
    // Skeleton to avoid CLS while hydrating
    return <div className="h-9 w-[7.5rem] rounded-full bg-ink/5" aria-hidden="true" />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex items-center rounded-full border border-ink/15 bg-paper p-0.5"
    >
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => setMode(opt.value)}
            className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
              active ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
