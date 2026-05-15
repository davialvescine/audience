'use client';

import { motion } from 'framer-motion';

type Props = {
  count: number;
  className?: string;
};

export function OnlineBadge({ count, className = '' }: Props) {
  if (count <= 0) return null;
  const label = `${count} ${count === 1 ? 'pessoa online' : 'pessoas online'}`;

  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className={`pointer-events-none absolute top-8 right-8 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-paper/15 backdrop-blur-md border border-paper/20 text-paper ${className}`}
    >
      {/* People icon */}
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <motion.span
        key={count}
        initial={{ scale: 1.4, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 18 }}
        className="text-2xl font-bold tabular-nums leading-none"
      >
        {count}
      </motion.span>
      <span className="text-sm opacity-80 leading-none">
        {count === 1 ? 'pessoa online' : 'pessoas online'}
      </span>
    </div>
  );
}
