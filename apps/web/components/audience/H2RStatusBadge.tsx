'use client';

import { useEffect, useState } from 'react';

import { computeH2RStatus } from '@/lib/h2r/status';

type Props = {
  pairedAt: string | null;
  lastHeartbeat: string | null;
};

export function H2RStatusBadge({ pairedAt, lastHeartbeat }: Props) {
  const [now, setNow] = useState(() => Date.now());

  // Re-evaluates every 10s so the operator sees H2R going offline live
  // (within 10s + the 90s heartbeat threshold) without refreshing.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const status = computeH2RStatus(pairedAt, lastHeartbeat, now);

  if (status === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 text-success font-medium">
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        H2R conectado
      </span>
    );
  }
  if (status === 'offline') {
    return <span className="text-danger font-medium">⚠ H2R offline</span>;
  }
  return <span className="text-ink/60">Não conectado ao H2R</span>;
}
