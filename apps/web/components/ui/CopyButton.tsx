'use client';

import { useState } from 'react';

type Props = {
  value: string;
  label?: string | undefined;
  className?: string;
};

export function CopyButton({ value, label, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ? `Copiar ${label}` : 'Copiar'}
      title={copied ? 'Copiado!' : 'Copiar'}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-md border border-ink/15 bg-paper hover:bg-ink/5 transition shrink-0 ${className}`}
    >
      {copied ? (
        <svg
          className="h-4 w-4 text-success"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 text-ink/60"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
          />
        </svg>
      )}
    </button>
  );
}

/** Inline label + value + copy button (used for URLs and pairing codes). */
export function CopyableField({
  value,
  label,
  monospace = true,
  className = '',
}: {
  value: string;
  label?: string | undefined;
  monospace?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`flex-1 min-w-0 px-3 h-9 inline-flex items-center rounded-md border border-ink/15 bg-paper text-ink text-sm truncate ${
          monospace ? 'font-mono' : ''
        }`}
      >
        {value}
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}
