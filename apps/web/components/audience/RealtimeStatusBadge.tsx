type Status = 'connecting' | 'connected' | 'error';

const VARIANTS: Record<Status, { dot: string; text: string; label: string }> = {
  connecting: {
    dot: 'bg-warning',
    text: 'text-warning',
    label: 'Conectando…',
  },
  connected: {
    dot: 'bg-success',
    text: 'text-success',
    label: 'Ao vivo',
  },
  error: {
    dot: 'bg-danger',
    text: 'text-danger',
    label: 'Offline (polling)',
  },
};

export function RealtimeStatusBadge({ status }: { status: Status }) {
  const v = VARIANTS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${v.text}`}
      title={`Realtime: ${v.label}`}
    >
      <span className={`h-2 w-2 rounded-full ${v.dot} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
      {v.label}
    </span>
  );
}
