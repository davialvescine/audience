'use client';

import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { CommentCard } from '@/components/telao/CommentCard';
import {
  customPositionStyles,
  DEFAULT_TELAO_CONFIG,
  positionStyles,
  type TelaoConfig,
} from '@/lib/telao/config';
import { resolveTelaoFont } from '@/lib/telao/fonts';
import { getSupabaseBrowserClient, getSupabaseRealtimeClient } from '@/lib/supabase/browser';

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
  /** Título opcional acima do card. Renderizado apenas se showTitle && title. */
  title?: string | undefined;
  showTitle?: boolean | undefined;
  /** Cor do título — separada do cardText pra evitar título branco invisível
   *  no fundo branco do browser_source. */
  titleColor?: string | undefined;
  /** Fonte do título — quando undefined, herda config.fontFamily. */
  titleFontFamily?: string | undefined;
  /** Sombra do título — útil pra contrastar em fundos coloridos. */
  titleShadow?: 'none' | 'subtle' | 'medium' | 'strong' | undefined;
  /** Tamanho da fonte do título em px. Undefined = config.fontSizePx * 1.4. */
  titleSizePx?: number | undefined;
  /** Chamado no pointerup do drag em preview mode. Alternativa ao postMessage
   *  pra quando o TelaoClient está no mesmo doc (ex: SlideCanvas). */
  onPositionChange?: ((pos: { posXPct: number; posYPct: number }) => void) | undefined;
  /** Ref opcional pro elemento que representa o palco 1920x1080 (escalado).
   *  Quando passado, o drag calcula % relativo a esse elemento (resolve o
   *  problema de iframe scaled). Sem ele, assume viewport nativo 1920x1080. */
  stageRef?: React.RefObject<HTMLElement | null> | undefined;
  /** Quando true, há um QR code sidebar à direita do stage. Empurra o
   *  card pra esquerda pra não sobrepor o QR. */
  qrSidebarActive?: boolean | undefined;
};

export function TelaoClient({
  slug,
  eventId,
  eventName,
  config: initialConfig,
  intervalSeconds = 3,
  preview = false,
  title,
  showTitle = false,
  titleColor,
  titleFontFamily,
  titleShadow,
  titleSizePx,
  onPositionChange,
  stageRef,
  qrSidebarActive = false,
}: Props) {
  const intervalRef = useRef(intervalSeconds);
  intervalRef.current = intervalSeconds;
  // Config comes from SSR (page.tsx is force-dynamic so F5 always picks
  // up DB changes). Preview mode receives live updates via postMessage
  // from the admin TelaoTab. For non-preview /telao tabs, refresh after
  // saving config in admin to see changes.
  const [config, setConfig] = useState<TelaoConfig>(initialConfig);
  // Quando o TelaoClient está embed direto (não em iframe), o prop
  // initialConfig muda quando o parent atualiza a config do slide. Sincroniza
  // o state interno pra refletir as mudanças do painel lateral em tempo real.
  // Deep-compare antes de setState — evita re-render loop quando o parent
  // re-cria o objeto config a cada render (mesmo conteúdo, ref nova).
  // Em preview iframe (TelaoTab antiga), o initialConfig nunca muda — usa
  // postMessage. Em ambos os casos esse useEffect é safe (no-op no iframe).
  useEffect(() => {
    setConfig((prev) =>
      JSON.stringify(prev) === JSON.stringify(initialConfig) ? prev : initialConfig,
    );
  }, [initialConfig]);
  const [visible, setVisible] = useState<Submission[]>([]);
  const [pinned, setPinned] = useState<Submission | null>(null);
  const queueRef = useRef<Submission[]>([]);
  // Altura do wrapper é controlada 100% pelo slider (effectiveHeight).
  // Ref mantido só pro caso futuro de drag/resize.
  const stackRef = useRef<HTMLDivElement | null>(null);
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

    // Broadcast efêmero pra mensagem-teste disparada pelo operador. NÃO toca
    // no banco — só empurra um card na fila local do telão pra ajustar
    // layout/timing sem poluir submissions/stats.
    const rt = getSupabaseRealtimeClient();
    const testChannel = rt.channel(`telao-test:${eventId}`, {
      config: { broadcast: { self: false } },
    });
    testChannel
      .on('broadcast', { event: 'test-comment' }, (msg) => {
        const payload = (msg.payload ?? {}) as { name?: string; comment?: string };
        const name = (payload.name ?? '').toString().slice(0, 50) || 'Teste';
        const comment =
          (payload.comment ?? '').toString().slice(0, 280) ||
          'Mensagem de teste — ajuste o telão.';
        queueRef.current.push({
          id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          comment,
          created_at: new Date().toISOString(),
        });
      })
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      clearInterval(pinTimer);
      void rt.removeChannel(testChannel);
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

  // Altura efetiva do card. Slider controla 100% — sem fallback pra
  // auto. Configs legadas com heightPx=0 caem em 240px (Pequeno).
  const effectiveHeight = config.heightPx > 0 ? config.heightPx : 240;
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

  // Captura dimensões do palco no pointerdown. Em modo telão (fullscreen,
  // viewport = 1920×1080), usa 1920/1080 direto. Em modo preview embed
  // (SlideCanvas), palco é escalado — pega a bounding rect do stageRef
  // pra calcular % corretamente.
  const stageRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!preview) return;
    const el = rootRef.current;
    if (!el) return;
    const stage = stageRef?.current?.getBoundingClientRect();
    const sRect = stage
      ? { left: stage.left, top: stage.top, width: stage.width, height: stage.height }
      : { left: 0, top: 0, width: 1920, height: 1080 };
    stageRectRef.current = sRect;
    const rect = el.getBoundingClientRect();
    const baseX = ((rect.left + rect.width / 2 - sRect.left) / sRect.width) * 100;
    const baseY = ((rect.top + rect.height / 2 - sRect.top) / sRect.height) * 100;
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
    const sRect = stageRectRef.current ?? { width: 1920, height: 1080 };
    const dx = ((e.clientX - d.startX) / sRect.width) * 100;
    const dy = ((e.clientY - d.startY) / sRect.height) * 100;
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
    onPositionChange?.({ posXPct: d.lastX, posYPct: d.lastY });
  };

  return (
    <>
      {showTitle && title ? (
        <h1
          style={{
            position: 'fixed',
            top: '4%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: titleColor ?? '#0A2540',
            fontFamily: resolveTelaoFont(titleFontFamily ?? config.fontFamily),
            fontSize: `${titleSizePx ?? Math.round(config.fontSizePx * 1.4)}px`,
            fontWeight: 700,
            textAlign: 'center',
            margin: 0,
            padding: 0,
            zIndex: 5,
            // 96% pra cobrir quase toda largura do stage (1920px) e
            // diminuir chance de quebrar em 2 linhas. whiteSpace nowrap
            // + ellipsis quando passa do limite (preferível a 2 linhas).
            maxWidth: '96%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow:
              titleShadow === 'strong'
                ? '0 4px 12px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45)'
                : titleShadow === 'medium'
                  ? '0 2px 8px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.30)'
                  : titleShadow === 'subtle'
                    ? '0 1px 3px rgba(0,0,0,0.25)'
                    : 'none',
          }}
        >
          {title}
        </h1>
      ) : null}
    <div
      id="telao-root"
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...positionStyle,
        // qrSidebarActive: compõe transform existente do positionStyle com
        // translateX(-240px) pra empurrar card à esquerda longe do QR (~340px
        // QR + folga). Funciona com qualquer anchor (center, left, right…).
        ...(qrSidebarActive
          ? {
              transform: positionStyle.transform
                ? `${positionStyle.transform} translateX(-240px)`
                : 'translateX(-240px)',
            }
          : {}),
        width: `${config.widthPct}%`,
        // Antes era 100vw e cortava card quando widthPct > 100 no admin.
        // Agora deixa crescer livre — slider já vai até 200%.
        fontFamily: resolveTelaoFont(config.fontFamily),
        cursor: preview ? (dragRef.current ? 'grabbing' : 'grab') : undefined,
        userSelect: preview ? 'none' : undefined,
        touchAction: preview ? 'none' : undefined,
      }}
    >
      {/* ANIMAÇÃO — CSS Grid stack pra eliminar QUALQUER salto.
          Estratégia: cada card é uma célula do grid, MAS todos compartilham
          a MESMA grid-area (1/1). Ou seja, ficam empilhados perfeitamente
          no mesmo ponto SEM precisar de position absolute.

          Vantagens vs position absolute:
          - Altura do grid é a do MAIOR card visível (auto-fit) — não há
            colapso quando um sai.
          - Card que entra herda EXATAMENTE a mesma posição do que sai.
          - Funciona com cards de tamanhos diferentes sem layout shift.

          Pra maxConcurrent>1 usa flow normal com gap. */}
      {(() => {
        const stackedSingle = config.maxConcurrent <= 1;
        return (
          <div
            ref={stackRef}
            style={
              stackedSingle
                ? {
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    // Altura controlada PELO USUÁRIO via slider. Compat:
                    // configs antigas (heightPx=0) caem em 240px default.
                    height: `${effectiveHeight}px`,
                  }
                : {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minHeight: `${effectiveHeight}px`,
                  }
            }
          >
            <AnimatePresence mode="sync" initial={false}>
              {renderList.map((m) => (
                <CommentCard
                  key={m.id}
                  m={m}
                  config={config}
                  eventName={eventName}
                  effectiveHeight={effectiveHeight}
                  stackedSingle={stackedSingle}
                />
              ))}
            </AnimatePresence>
          </div>
        );
      })()}
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
    </>
  );
}
