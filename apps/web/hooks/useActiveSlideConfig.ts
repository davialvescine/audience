'use client';

import { useEffect, useRef, useState } from 'react';

import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type ChannelLike = {
  on: (
    event: string,
    filter: { table?: string; event?: string; schema?: string; filter?: string },
    cb: (payload: {
      eventType: string;
      new: Record<string, unknown>;
      old: Record<string, unknown>;
      table: string;
    }) => void,
  ) => ChannelLike;
  subscribe: (statusCb?: (status: string) => void) => ChannelLike;
  unsubscribe: () => void;
};

export type UseActiveSlideOptions = {
  initialActiveSlideId: string | null;
  initialActiveConfig: WordcloudConfig | null;
  channel?: ChannelLike | undefined;
};

/**
 * Audiência: mantém o slide ativo + sua config sincronizados via Realtime.
 *
 * Critical: subscribe roda UMA vez (deps só [channel, eventId]). O callback
 * lê activeSlideId via ref pra evitar closure stale — se trocar `activeSlideId`
 * nas deps do useEffect, cada mudança re-monta o subscribe (Supabase reseta
 * o canal a cada `on()` novo só funcionando antes do primeiro `subscribe`).
 */
export function useActiveSlideConfig(
  eventId: string,
  opts: UseActiveSlideOptions,
): { activeSlideId: string | null; config: WordcloudConfig | null } {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(opts.initialActiveSlideId);
  const [config, setConfig] = useState<WordcloudConfig | null>(opts.initialActiveConfig);
  const activeSlideIdRef = useRef<string | null>(opts.initialActiveSlideId);

  // Mantém ref em sincronia com state — usado dentro do callback de slides UPDATE
  // pra saber qual slide está ativo agora (sem closure stale).
  useEffect(() => {
    activeSlideIdRef.current = activeSlideId;
  }, [activeSlideId]);

  useEffect(() => {
    const ch = opts.channel;
    if (!ch) return;

    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
      (payload) => {
        const row = payload.new as { active_slide_id?: string | null };
        if ('active_slide_id' in row) {
          setActiveSlideId(row.active_slide_id ?? null);
          activeSlideIdRef.current = row.active_slide_id ?? null;
        }
      },
    )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'slides', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as { id?: string; config?: WordcloudConfig };
          if (row.id && row.id === activeSlideIdRef.current && row.config) {
            setConfig(row.config);
          }
        },
      )
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, opts.channel]);

  // Polling fallback — refetch active slide + config every 3s. Caso o
  // Realtime falhe (firewall, CSP, transport, etc.), o celular ainda
  // pega as mudanças do operador em ~3s.
  useEffect(() => {
    let cancelled = false;
    const sb = getSupabaseBrowserClient();
    const poll = async () => {
      const { data: ev } = await sb
        .from('events')
        .select('active_slide_id')
        .eq('id', eventId)
        .maybeSingle();
      if (cancelled) return;
      const newActiveId = (ev as { active_slide_id?: string | null } | null)?.active_slide_id ?? null;
      if (newActiveId !== activeSlideIdRef.current) {
        setActiveSlideId(newActiveId);
        activeSlideIdRef.current = newActiveId;
      }
      if (newActiveId) {
        const { data: slideRow } = await sb
          .from('slides')
          .select('config')
          .eq('id', newActiveId)
          .maybeSingle();
        if (cancelled) return;
        const cfg = (slideRow as { config?: WordcloudConfig } | null)?.config;
        if (cfg) {
          // Só atualiza se realmente mudou (evita re-render desnecessário)
          setConfig((prev) =>
            JSON.stringify(prev) === JSON.stringify(cfg) ? prev : cfg,
          );
        }
      } else {
        setConfig(null);
      }
    };
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [eventId]);

  return { activeSlideId, config };
}
