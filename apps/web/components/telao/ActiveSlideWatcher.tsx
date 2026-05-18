'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { getSupabaseBrowserClient, getSupabaseRealtimeClient } from '@/lib/supabase/browser';

type Props = {
  eventId: string;
  /** active_slide_id no momento do SSR — pra detectar quando muda no client. */
  initialActiveSlideId: string | null;
  /** Tipo do slide ativo no SSR — refresh quando o tipo muda. */
  initialActiveType: 'wordcloud' | 'open_ended' | 'comments' | 'poll' | null;
};

type WatchedType = 'wordcloud' | 'open_ended' | 'comments' | 'poll';

/**
 * Telão: força router.refresh() quando o tipo do slide ativo muda.
 *
 * Necessário porque qual switcher renderiza (TelaoWordcloudSwitcher vs
 * TelaoOpenEndedSwitcher) é decidido no SSR. Sem isso, operador troca
 * de nuvem pra aberto e o telão continua mostrando o switcher antigo.
 *
 * Refresh re-executa o SSR e React re-monta com o switcher correto.
 */
export function ActiveSlideWatcher({
  eventId,
  initialActiveSlideId,
  initialActiveType,
}: Props) {
  const router = useRouter();
  const lastSeenIdRef = useRef<string | null>(initialActiveSlideId);
  const lastSeenTypeRef = useRef<WatchedType | null>(initialActiveType);

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ch = rt.channel(`telao-watcher:${eventId}:${Date.now()}`);
    const sb = getSupabaseBrowserClient();

    const refreshIfTypeChanged = async (newId: string | null) => {
      if (!newId) {
        if (lastSeenTypeRef.current !== null) {
          lastSeenTypeRef.current = null;
          lastSeenIdRef.current = null;
          router.refresh();
        }
        return;
      }
      const { data } = await sb.from('slides').select('type').eq('id', newId).maybeSingle();
      const newType = (data as { type?: string } | null)?.type;
      if (
        newType !== 'wordcloud' &&
        newType !== 'open_ended' &&
        newType !== 'comments' &&
        newType !== 'poll'
      ) {
        return;
      }
      // Refresh em qualquer mudança (tipo OU id). O optimization de
      // "só refresh em type change" causava vazamento de config entre
      // slides quando realtime/polling não recompunha corretamente.
      if (newType !== lastSeenTypeRef.current || newId !== lastSeenIdRef.current) {
        lastSeenTypeRef.current = newType;
        lastSeenIdRef.current = newId;
        router.refresh();
      }
    };

    ch.on(
      'postgres_changes' as never,
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` } as never,
      (payload: { new: { active_slide_id?: string | null } }) => {
        const newId = payload.new?.active_slide_id ?? null;
        void refreshIfTypeChanged(newId);
      },
    ).subscribe();

    // Polling fallback agressivo (500ms) — caso o websocket caia, pega mudança
    // de slide ativo quase instantaneamente. Quase grátis: 1 SELECT por evento.
    // Quando Realtime funciona, o subscribe acima fira primeiro e o poll vira no-op.
    const poll = async () => {
      const { data } = await sb
        .from('events')
        .select('active_slide_id')
        .eq('id', eventId)
        .maybeSingle();
      const newId =
        (data as { active_slide_id?: string | null } | null)?.active_slide_id ?? null;
      if (newId !== lastSeenIdRef.current) {
        await refreshIfTypeChanged(newId);
      }
    };
    const pollInterval = setInterval(() => void poll(), 500);

    return () => {
      ch.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [eventId, router]);

  return null;
}
