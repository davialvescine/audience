type Status = 'connecting' | 'connected' | 'error';

const VARIANTS: Record<Status, { dot: string; text: string; label: string }> = {
  connecting: {
    dot: 'bg-ink/30',
    text: 'text-ink/55',
    label: 'Conectando…',
  },
  connected: {
    dot: 'bg-success',
    text: 'text-success',
    label: 'Ao vivo',
  },
  error: {
    // Em produção o WebSocket Realtime não conecta de forma confiável;
    // polling de 2s cobre tudo. Visualmente neutro pra não alarmar —
    // sistema funciona bem com polling.
    dot: 'bg-ink/30',
    text: 'text-ink/55',
    label: 'Polling 2s',
  },
};

export function RealtimeStatusBadge({ status }: { status: Status }) {
  const v = VARIANTS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${v.text}`}
      title={`Realtime: ${v.label}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${v.dot} ${status === 'connecting' ? 'animate-pulse' : ''}`}
      />
      {v.label}
    </span>
  );
}
