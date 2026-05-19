'use client';

import { useOnlinePresence } from '@/hooks/useOnlinePresence';

type PresenceChannelLike = NonNullable<Parameters<typeof useOnlinePresence>[0]['channel']>;

type Props = {
  /** Channel de presence pra contar quem está online (audiência conectada). */
  presenceChannel: PresenceChannelLike;
  /** Contador principal — ex: "12 comentários" ou "47 votos". */
  count?: number | undefined;
  /** Singular do label (ex: "comentário"). Vira plural automático com 's'. */
  label?: string | undefined;
  /** Cor do texto. Default branco. */
  color?: string | undefined;
};

/**
 * Badge flutuante no canto inferior esquerdo do telão. Mostra contador
 * principal + pessoas online. Renderizada por todos os switchers
 * (comments, poll, wordcloud, open_ended) pra consistência visual.
 */
export function StatsBadge({ presenceChannel, count, label, color = '#FFFFFF' }: Props) {
  const presence = useOnlinePresence({ channel: presenceChannel });
  return (
    <div
      className="absolute bottom-8 left-8 z-20 flex items-center gap-5 px-5 py-2.5 rounded-full bg-black/40 backdrop-blur-md text-base font-medium pointer-events-none"
      style={{ color }}
    >
      {typeof count === 'number' ? (
        <span className="flex items-center gap-2">
          <span className="font-bold tabular-nums">{count}</span>
          <span className="opacity-75">
            {label ? (count === 1 ? label : `${label}s`) : ''}
          </span>
        </span>
      ) : null}
      <span className="flex items-center gap-2">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className="font-bold tabular-nums">{presence.count}</span>
        <span className="opacity-75">online</span>
      </span>
    </div>
  );
}
