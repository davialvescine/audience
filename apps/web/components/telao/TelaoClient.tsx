'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import {
  animationVariants,
  customPositionStyles,
  DEFAULT_TELAO_CONFIG,
  positionStyles,
  shadowStyle,
  type TelaoConfig,
} from '@/lib/telao/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

import { snapToGrid } from './snapToGrid';

type Submission = {
  id: string;
  name: string;
  comment: string;
  created_at: string;
  // Base submission id (sem o sufixo de sent_at). Usado pra remover
  // entradas da fila quando a mensagem e fixada — fixada nao deve
  // aparecer em rotacao automatica.
  submissionId?: string;
};

type Props = {
  slug: string;
  eventId: string;
  eventName: string;
  config: TelaoConfig;
  intervalSeconds?: number;
  preview?: boolean;
};

export function TelaoClient({
  slug,
  eventId,
  eventName,
  config: initialConfig,
  intervalSeconds = 3,
  preview = false,
}: Props) {
  const intervalRef = useRef(intervalSeconds);
  intervalRef.current = intervalSeconds;
  // Config comes from SSR (page.tsx is force-dynamic so F5 always picks
  // up DB changes). Preview mode receives live updates via postMessage
  // from the admin TelaoTab. For non-preview /telao tabs, refresh after
  // saving config in admin to see changes.
  const [config, setConfig] = useState<TelaoConfig>(initialConfig);
  const [visible, setVisible] = useState<Submission[]>([]);
  const [pinned, setPinned] = useState<Submission | null>(null);
  const queueRef = useRef<Submission[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Id da submission atualmente fixada. Atualizado no pollPinned. Usado
  // pelo enqueue pra nao colocar na fila de rotacao a propria fixada
  // (senao reaparece sozinha quando o operador clica "Tirar do telao").
  const pinnedIdRef = useRef<string | null>(null);

  const [previewSample, setPreviewSample] = useState<{ name: string; comment: string }>({
    name: 'João da Silva',
    comment: 'Que evento incrível! Deus abençoe todos vocês.',
  });

  const [playCycleId, setPlayCycleId] = useState(0);

  // Listen for live config updates via postMessage when in preview mode
  useEffect(() => {
    if (!preview) return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as {
        type?: string;
        config?: TelaoConfig;
        sample?: { name: string; comment: string };
        intervalSeconds?: number;
        samples?: Array<{ name: string; comment: string }>;
      };
      if (data.type === 'telao-config-update' && data.config) {
        setConfig(data.config);
      }
      if (data.type === 'telao-sample-update' && data.sample) {
        setPreviewSample(data.sample);
      }
      if (data.type === 'telao-play-cycle') {
        setPlayCycleId((id) => id + 1);
      }
      if (data.type === 'telao-play-queue' && data.samples) {
        // Empilha as amostras na queue real — vai sair pelo tick live
        // respeitando maxConcurrent, displaySeconds e transitionMode.
        // Limpa o card estatico do preview pra nao contar no maxConcurrent.
        setVisible([]);
        visibleCountRef.current = 0;
        const ts = Date.now();
        for (let i = 0; i < data.samples.length; i += 1) {
          const s = data.samples[i]!;
          queueRef.current.push({
            id: `demo-${ts}-${i}`,
            name: s.name,
            comment: s.comment,
            created_at: new Date().toISOString(),
          });
        }
        if (typeof data.intervalSeconds === 'number') {
          intervalRef.current = data.intervalSeconds;
        }
      }
    };
    window.addEventListener('message', handler);
    // Tell parent we're ready (parent then sends initial config)
    window.parent.postMessage({ type: 'telao-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', handler);
  }, [preview]);

  // Subscribe to new sent submissions (Realtime) + polling fallback every 3s.
  // Belt-and-suspenders: if Realtime is blocked (corporate networks,
  // CDN/proxy, expired subscription) the poll catches up.
  useEffect(() => {
    if (preview) return;
    const supabase = getSupabaseBrowserClient();
    // Dedup por id+sent_at: a mesma submission re-enviada (botao "Mostrar
    // novamente") tem novo sent_at, entao conta como nova entrada na fila.
    // Sem dedup local: o lastSeenAt no poll ja garante que so pegamos
    // submissions com sent_at maior que o ultimo visto. Reshow gera novo
    // sent_at, entao volta como entrada nova.
    const enqueue = (row: Submission & { sent_at?: string | null }) => {
      // Se a mensagem ja esta fixada, nao entra na rotacao — ela e
      // renderizada via o slot `pinned`. Sem esse guard, ao "Tirar do
      // telao" a mensagem reapareceria pelo tick consumindo a fila.
      if (pinnedIdRef.current && row.id === pinnedIdRef.current) return;
      queueRef.current.push({
        id: `${row.id}-${row.sent_at ?? Date.now()}`,
        submissionId: row.id,
        name: row.name,
        comment: row.comment,
        created_at: row.created_at,
      });
    };

    // Polling via security-definer RPC. RLS sobre submissions e
    // owner-only — anon nao pode SELECT direto. A RPC e scoped ao slug
    // e seguramente expoe so os comentarios sent desse evento.
    let lastSeenAt = new Date().toISOString();
    const poll = async () => {
      const { data, error } = await supabase.rpc('get_telao_submissions_since', {
        p_slug: slug,
        p_since: lastSeenAt,
      });
      if (error || !data || data.length === 0) return;
      for (const row of data) {
        if (row.sent_at && row.sent_at > lastSeenAt) lastSeenAt = row.sent_at;
        enqueue({
          id: row.id,
          name: row.name,
          comment: row.comment,
          created_at: row.created_at,
          sent_at: row.sent_at,
        });
      }
    };
    const pollTimer = setInterval(() => {
      void poll();
    }, 2000);

    // Poll config tambem — quando o dono muda cor/posicao no admin,
    // todas as telas /telao abertas (OBS, PiP, desktop) atualizam em
    // ate 5s sem precisar recarregar.
    const pollConfig = async () => {
      const { data, error } = await supabase.rpc('get_telao_config', { p_slug: slug });
      if (error || !data || data.length === 0) return;
      const event = data[0];
      if (!event) return;
      const overrides = (event.configs as Record<string, Partial<TelaoConfig>> | null) ?? {};
      // mode no preview e ignorado; em live, usamos o config global.
      // (per-mode override e aplicado no SSR via page.tsx, podemos
      // honrar tambem aqui depois se precisar.)
      const fresh: TelaoConfig = {
        ...DEFAULT_TELAO_CONFIG,
        ...((event.config as Partial<TelaoConfig>) ?? {}),
        ...(overrides.global ?? {}),
      };
      setConfig((cur) => (JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh));
    };
    const cfgTimer = setInterval(() => {
      void pollConfig();
    }, 5000);

    // Polling de mensagem fixada. Quando muda, atualiza state. Renderiza
    // por tempo indeterminado ate ser desfixada (server seta null).
    const pollPinned = async () => {
      const { data, error } = await supabase.rpc('get_pinned_submission', { p_slug: slug });
      if (error) return;
      const row = data?.[0];
      if (!row) {
        pinnedIdRef.current = null;
        setPinned((cur) => (cur === null ? cur : null));
        return;
      }
      pinnedIdRef.current = row.id;
      // Limpa entradas da fila com a mesma submission (a pinada entra como
      // 'sent' no get_telao_submissions_since e foi enfileirada antes do
      // pollPinned detectar a fixacao — sem esse drain, reapareceria
      // assim que o operador clicasse "Tirar do telao").
      queueRef.current = queueRef.current.filter((q) => q.submissionId !== row.id);
      setPinned((cur) => {
        if (cur && cur.id === row.id) return cur;
        return {
          id: row.id,
          name: row.name,
          comment: row.comment,
          created_at: row.sent_at ?? new Date().toISOString(),
        };
      });
    };
    void pollPinned();
    const pinTimer = setInterval(() => {
      void pollPinned();
    }, 2000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(cfgTimer);
      clearInterval(pinTimer);
    };
  }, [eventId, slug, preview]);

  // Preview default state: render the sample message statically se nao
  // tiver um demo de fila rodando.
  useEffect(() => {
    if (!preview) return;
    if (playCycleId > 0) return;
    if (queueRef.current.length > 0) return;
    setVisible([
      {
        id: `preview-${previewSample.name}-${previewSample.comment}`,
        name: previewSample.name || 'Nome de exemplo',
        comment: previewSample.comment || 'Mensagem de exemplo aparece aqui.',
        created_at: new Date().toISOString(),
      },
    ]);
  }, [preview, playCycleId, previewSample]);

  // Preview enter/exit cycle: triggered by parent's "Tocar entrada e saída" button
  useEffect(() => {
    if (!preview) return;
    if (playCycleId === 0) return; // not triggered yet
    setVisible([]); // clear so AnimatePresence registers the next push as a fresh enter
    const enterTimer = setTimeout(() => {
      setVisible([
        {
          id: `cycle-${playCycleId}`,
          name: previewSample.name || 'Nome de exemplo',
          comment: previewSample.comment || 'Mensagem de exemplo aparece aqui.',
          created_at: new Date().toISOString(),
        },
      ]);
    }, 250);
    const exitTimer = setTimeout(
      () => {
        setVisible([]);
      },
      250 + config.displaySeconds * 1000,
    );
    // Apos a animacao de saida, restaura o sample estatico — operador
    // continua vendo o card no preview mesmo depois do ciclo terminar.
    const restoreTimer = setTimeout(
      () => {
        setVisible([
          {
            id: `preview-${previewSample.name}-${previewSample.comment}`,
            name: previewSample.name || 'Nome de exemplo',
            comment: previewSample.comment || 'Mensagem de exemplo aparece aqui.',
            created_at: new Date().toISOString(),
          },
        ]);
      },
      250 + config.displaySeconds * 1000 + 600,
    );
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(restoreTimer);
    };
  }, [playCycleId, preview, previewSample, config.displaySeconds]);

  // Live tick: pull from queue. Dois modos de transicao:
  // - 'sequential': mensagem sai completamente, espera intervalSeconds,
  //   so depois entra a proxima. Mantem visible=[].
  // - 'overlap': a nova entra empurrando a antiga pra cima durante a
  //   saida (sobrepoe momentaneamente).
  const lastRemovedAtRef = useRef(0);
  const visibleCountRef = useRef(0);
  const removeTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Limite efetivo de cards visiveis. Comeca como config.maxConcurrent, mas
  // diminui se a pilha exceder a tela (cards nao cabem). Nesse caso o tick
  // nao tenta mais empilhar — o novo espera na fila ate sobrar espaco.
  const effectiveMaxRef = useRef(initialConfig.maxConcurrent);
  useEffect(() => {
    // Em preview, o tick tambem roda — alimentado por demo queue (postMessage).
    // IMPORTANTE: nao fazer shift() de queueRef dentro de setState updater.
    // Em Strict Mode (dev), o updater roda 2x e consome 2 items, mas so 1
    // chega na visible. Deixar shift fora do updater garante consumo unico.
    const tick = setInterval(() => {
      if (pinned) return;
      if (queueRef.current.length === 0) return;
      if (visibleCountRef.current >= Math.min(config.maxConcurrent, effectiveMaxRef.current))
        return;
      if (
        config.transitionMode === 'sequential' &&
        visibleCountRef.current === 0 &&
        lastRemovedAtRef.current > 0 &&
        Date.now() - lastRemovedAtRef.current < intervalRef.current * 1000
      ) {
        return;
      }
      const next = queueRef.current.shift();
      if (!next) return;
      visibleCountRef.current += 1;
      const removeAfter = config.displaySeconds * 1000;
      const timeoutId = setTimeout(() => {
        removeTimeoutsRef.current.delete(next.id);
        lastRemovedAtRef.current = Date.now();
        visibleCountRef.current = Math.max(0, visibleCountRef.current - 1);
        setVisible((cur) => cur.filter((m) => m.id !== next.id));
      }, removeAfter);
      removeTimeoutsRef.current.set(next.id, timeoutId);
      setVisible((cur) => [...cur, next]);
    }, 250);
    return () => clearInterval(tick);
  }, [preview, config.maxConcurrent, config.displaySeconds, config.transitionMode, pinned]);

  // Cull APENAS quando visible cresceu (alguem foi adicionado). Evita
  // cascata de culls que sumiria com varios cards de uma vez.
  const prevVisibleLenRef = useRef(0);
  useEffect(() => {
    const grew = visible.length > prevVisibleLenRef.current;
    prevVisibleLenRef.current = visible.length;
    if (!grew) return;
    if (visible.length < 2) return;
    const el = rootRef.current;
    if (!el) return;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const maxAllowed = vh * 0.9;
    if (el.offsetHeight > maxAllowed) {
      const newest = visible[visible.length - 1];
      if (!newest) return;
      const t = removeTimeoutsRef.current.get(newest.id);
      if (t) {
        clearTimeout(t);
        removeTimeoutsRef.current.delete(newest.id);
      }
      queueRef.current.unshift(newest);
      visibleCountRef.current = Math.max(0, visibleCountRef.current - 1);
      effectiveMaxRef.current = visible.length - 1;
      setVisible((cur) => cur.slice(0, -1));
    }
  }, [visible]);

  // Reset do limite efetivo quando o usuario muda a config (ex.: aumenta
  // tamanho da fonte ou mexe no maxConcurrent — vamos tentar empilhar de novo).
  useEffect(() => {
    effectiveMaxRef.current = config.maxConcurrent;
  }, [config.maxConcurrent, config.fontSizePx, config.heightPx, config.widthPct, config.position]);

  // Se maxConcurrent baixou abaixo do que esta visivel, remove os mais
  // antigos ate respeitar o novo limite.
  useEffect(() => {
    if (visible.length > config.maxConcurrent) {
      const toRemove = visible.length - config.maxConcurrent;
      for (let i = 0; i < toRemove; i++) {
        const oldest = visible[i];
        if (oldest) {
          const t = removeTimeoutsRef.current.get(oldest.id);
          if (t) {
            clearTimeout(t);
            removeTimeoutsRef.current.delete(oldest.id);
          }
        }
      }
      visibleCountRef.current = Math.max(0, visibleCountRef.current - toRemove);
      setVisible((cur) => cur.slice(toRemove));
    }
  }, [config.maxConcurrent, visible]);

  const variants = animationVariants(config.animation);
  // Pra anchors superiores, novos no topo (empilha pra baixo).
  // Pra anchors inferiores, novos embaixo (empilha pra cima).
  const renderList = pinned
    ? [pinned]
    : config.position.startsWith('top-')
      ? [...visible].reverse()
      : visible;
  const hasCustomPos = typeof config.posXPct === 'number' && typeof config.posYPct === 'number';
  const positionStyle = hasCustomPos
    ? customPositionStyles(config.posXPct as number, config.posYPct as number)
    : positionStyles(config.position);

  // Drag-to-position (preview only). The preview iframe runs at 1920x1080
  // native, so pointer.clientX/Y are already in stage coords — no scale math.
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const [dragHud, setDragHud] = useState<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!preview) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const baseX = ((rect.left + rect.width / 2) / 1920) * 100;
    const baseY = ((rect.top + rect.height / 2) / 1080) * 100;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX,
      baseY,
      lastX: baseX,
      lastY: baseY,
    };
    setDragHud({ x: baseX, y: baseY });
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / 1920) * 100;
    const dy = ((e.clientY - d.startY) / 1080) * 100;
    // Snap em 0/25/50/75/100% quando dentro de 3% — o operador agarra
    // os cantos/centro sem precisar mirar pixel-perfect.
    const nx = snapToGrid(d.baseX + dx, 3);
    const ny = snapToGrid(d.baseY + dy, 3);
    d.lastX = nx;
    d.lastY = ny;
    setDragHud({ x: nx, y: ny });
    setConfig((c) => ({ ...c, posXPct: nx, posYPct: ny }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    rootRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragHud(null);
    // Tell parent so autosave persists the new coords.
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'telao-position-update',
          posXPct: d.lastX,
          posYPct: d.lastY,
        },
        window.location.origin,
      );
    }
  };

  return (
    <div
      id="telao-root"
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...positionStyle,
        width: `${config.widthPct}%`,
        maxWidth: '100vw',
        fontFamily: config.fontFamily,
        cursor: preview ? (dragRef.current ? 'grabbing' : 'grab') : undefined,
        userSelect: preview ? 'none' : undefined,
        touchAction: preview ? 'none' : undefined,
      }}
    >
      <AnimatePresence>
        {renderList.map((m) => (
          <motion.div
            key={`${m.id}-${config.animation}-${config.position}-${config.fontSizePx}-${config.cardBg}-${config.cardText}-${config.borderRadius}-${config.shadow}-${config.backdropBlur}-${config.widthPct}-${config.heightPx}`}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3"
            style={{
              background: config.cardBg,
              color: config.cardText,
              borderRadius: `${config.borderRadius}px`,
              boxShadow: shadowStyle(config.shadow),
              backdropFilter:
                config.backdropBlur > 0 ? `blur(${config.backdropBlur}px)` : undefined,
              WebkitBackdropFilter:
                config.backdropBlur > 0 ? `blur(${config.backdropBlur}px)` : undefined,
              padding: `${Math.round(config.fontSizePx * 0.6)}px ${Math.round(config.fontSizePx * 0.85)}px`,
              fontSize: `${config.fontSizePx}px`,
              lineHeight: 1.3,
              minHeight: config.heightPx > 0 ? `${config.heightPx}px` : undefined,
              display: config.heightPx > 0 ? 'flex' : undefined,
              flexDirection: config.heightPx > 0 ? 'column' : undefined,
              justifyContent: config.heightPx > 0 ? 'center' : undefined,
            }}
          >
            <div
              style={{
                fontSize: `${Math.round(config.fontSizePx * 0.55)}px`,
                opacity: 0.75,
                fontWeight: 600,
                letterSpacing: '0.02em',
                marginBottom: '0.25em',
              }}
            >
              {config.showEventName ? <span style={{ marginRight: 8 }}>{eventName} ·</span> : null}
              {m.name}
              {config.showTimestamp ? (
                <span style={{ marginLeft: 8, opacity: 0.6 }} suppressHydrationWarning>
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </div>
            <div style={{ fontWeight: 500, wordBreak: 'break-word' }}>{m.comment}</div>
          </motion.div>
        ))}
      </AnimatePresence>
      {preview && dragHud ? (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            background: 'rgba(0,0,0,0.78)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 8,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 14,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          X: {Math.round(dragHud.x)}% · Y: {Math.round(dragHud.y)}%
        </div>
      ) : null}
    </div>
  );
}
