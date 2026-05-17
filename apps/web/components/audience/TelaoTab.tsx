'use client';

import { useEffect, useRef, useState } from 'react';

import { DispatchIntervalForm } from '@/components/audience/DispatchIntervalForm';
import { PairingCodeDisplay } from '@/components/audience/PairingCodeDisplay';
import {
  ColorInput,
  PresetGroup,
  Slider,
} from '@/components/audience/TelaoConfigControls';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyableField } from '@/components/ui/CopyButton';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  DEFAULT_TELAO_CONFIG,
  DISPLAY_MODE_LABELS,
  type TelaoAnimation,
  type TelaoConfig,
  type TelaoDisplayMode,
  type TelaoShadow,
} from '@/lib/telao/config';
import {
  setTelaoConfigOverride,
  updateDisplayModes,
  updateTelaoConfig,
} from '@/server-actions/telao';
import { updateDispatchInterval } from '@/server-actions/moderation';

const ANIMATIONS: TelaoAnimation[] = [
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'fade',
  'scale',
  'bounce',
];

const SAMPLE_PRESETS = [
  {
    label: 'Curto',
    name: 'Ana',
    comment: 'Top demais!',
  },
  {
    label: 'Médio',
    name: 'João da Silva',
    comment: 'Que evento incrível! Deus abençoe todos vocês.',
  },
  {
    label: 'Longo',
    name: 'Maria Aparecida Souza',
    comment:
      'Estou muito emocionada com tudo que escutei hoje. Que Deus continue abençoando o trabalho de cada um. Vou levar pra casa.',
  },
  {
    label: 'Emoji',
    name: 'Pedro 🙏',
    comment: '🔥🔥🔥 Glória a Deus! 🙏✨ Maravilha!',
  },
] as const;
const SHADOWS: TelaoShadow[] = ['none', 'subtle', 'medium', 'dramatic'];
// H2R Graphics e Chrome PiP removidos da UI a pedido do operador — valores
// continuam no enum do DB pra não quebrar eventos antigos que tenham eles
// salvos em enabled_display_modes, mas não aparecem mais no seletor.
const ALL_MODES: TelaoDisplayMode[] = ['browser_source', 'desktop_app'];

const MODE_SHORT_LABELS: Record<TelaoDisplayMode, string> = {
  h2r: 'H2R',
  browser_source: 'OBS / Browser Source',
  chrome_pip: 'Chrome PiP',
  desktop_app: 'Desktop App',
};

type Props = {
  eventId: string;
  slug: string;
  initialConfig: TelaoConfig;
  initialModes: TelaoDisplayMode[];
  initialOverrides: Partial<Record<TelaoDisplayMode, TelaoConfig>>;
  publicTelaoUrl: string;
  h2r: {
    alreadyPaired: boolean;
    lastHeartbeat: string | null;
    dispatchIntervalSeconds: number;
  };
};

type EditingMode = 'global' | TelaoDisplayMode;

export function TelaoTab({
  eventId,
  slug,
  initialConfig,
  initialModes,
  initialOverrides,
  publicTelaoUrl,
  h2r,
}: Props) {
  const [editingMode, setEditingMode] = useState<EditingMode>('global');
  const [globalConfig, setGlobalConfig] = useState<TelaoConfig>(initialConfig);
  const [overrides, setOverrides] =
    useState<Partial<Record<TelaoDisplayMode, TelaoConfig>>>(initialOverrides);
  const config: TelaoConfig =
    editingMode === 'global' ? globalConfig : (overrides[editingMode] ?? globalConfig);
  const setConfig: React.Dispatch<React.SetStateAction<TelaoConfig>> = (updater) => {
    if (editingMode === 'global') {
      setGlobalConfig(updater);
    } else {
      setOverrides((prev) => {
        const current = prev[editingMode] ?? globalConfig;
        const next = typeof updater === 'function' ? updater(current) : updater;
        return { ...prev, [editingMode]: next };
      });
    }
  };
  const isOverrideActive = editingMode !== 'global' && overrides[editingMode] !== undefined;
  const [modes, setModes] = useState<TelaoDisplayMode[]>(initialModes);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [sample, setSample] = useState({
    name: 'João da Silva',
    comment: 'Que evento incrível! Deus abençoe todos vocês.',
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.3125);
  const [iframeReady, setIframeReady] = useState(false);

  // Scale the 1920x1080 iframe to fit the preview box width.
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => setPreviewScale(el.clientWidth / 1920);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Snapshot of last-saved values so we don't loop on the same data
  const lastSavedRef = useRef({
    globalConfig: initialConfig,
    overrides: initialOverrides,
    modes: initialModes,
  });
  // Monotonic version of the most recently dispatched save. When a save
  // promise resolves, we only commit lastSavedRef if its version is still
  // current — otherwise a slow request from earlier could overwrite a
  // fresher state (autosave race protection — Sprint 1.5).
  const saveVersionRef = useRef(0);

  // Listen for iframe "ready" signal so we can send initial config
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as {
        type?: string;
        posXPct?: number;
        posYPct?: number;
      };
      if (data.type === 'telao-preview-ready') {
        setIframeReady(true);
      }
      if (
        data.type === 'telao-position-update' &&
        typeof data.posXPct === 'number' &&
        typeof data.posYPct === 'number'
      ) {
        setConfig((c) => ({ ...c, posXPct: data.posXPct, posYPct: data.posYPct }));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Push config updates to iframe in real time as user adjusts sliders
  useEffect(() => {
    if (!iframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'telao-config-update', config },
      window.location.origin,
    );
  }, [config, iframeReady]);

  // Push sample updates to iframe so user can see how their text looks
  useEffect(() => {
    if (!iframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'telao-sample-update', sample },
      window.location.origin,
    );
  }, [sample, iframeReady]);

  // Auto-play animation cycle whenever animation changes — the user
  // gets an immediate visual instead of having to click ▶.
  useEffect(() => {
    if (!iframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'telao-play-cycle' },
      window.location.origin,
    );
  }, [config.animation, iframeReady]);

  // Debounced autosave: fires 600ms after the last config / modes change
  useEffect(() => {
    const last = lastSavedRef.current;
    const globalUnchanged = JSON.stringify(globalConfig) === JSON.stringify(last.globalConfig);
    const overridesUnchanged = JSON.stringify(overrides) === JSON.stringify(last.overrides);
    const modesUnchanged =
      JSON.stringify([...modes].sort()) === JSON.stringify([...last.modes].sort());
    if (globalUnchanged && overridesUnchanged && modesUnchanged) return;

    const t = setTimeout(() => {
      saveVersionRef.current += 1;
      const myVersion = saveVersionRef.current;
      setAutoSaveStatus('saving');

      // Find which overrides changed (added/removed/modified)
      const changedOverrides: TelaoDisplayMode[] = [];
      const allKeys = new Set<TelaoDisplayMode>([
        ...(Object.keys(last.overrides) as TelaoDisplayMode[]),
        ...(Object.keys(overrides) as TelaoDisplayMode[]),
      ]);
      for (const k of allKeys) {
        if (JSON.stringify(last.overrides[k]) !== JSON.stringify(overrides[k])) {
          changedOverrides.push(k);
        }
      }

      void Promise.all([
        globalUnchanged
          ? Promise.resolve({ ok: true } as const)
          : updateTelaoConfig(eventId, globalConfig),
        modesUnchanged
          ? Promise.resolve({ ok: true } as const)
          : updateDisplayModes(eventId, modes),
        ...changedOverrides.map((mode) =>
          setTelaoConfigOverride(eventId, mode, overrides[mode] ?? null),
        ),
      ]).then((results) => {
        if (myVersion < saveVersionRef.current) return;
        const allOk = results.every((r) => r.ok);
        if (allOk) {
          lastSavedRef.current = { globalConfig, overrides, modes };
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 1500);
        } else {
          setAutoSaveStatus('error');
          setTimeout(() => setAutoSaveStatus('idle'), 3000);
        }
      });
    }, 600);

    return () => clearTimeout(t);
  }, [globalConfig, overrides, modes, eventId]);

  const dirty =
    JSON.stringify(globalConfig) !== JSON.stringify(lastSavedRef.current.globalConfig) ||
    JSON.stringify(overrides) !== JSON.stringify(lastSavedRef.current.overrides) ||
    JSON.stringify([...modes].sort()) !== JSON.stringify([...lastSavedRef.current.modes].sort());

  const updateField = <K extends keyof TelaoConfig>(key: K, value: TelaoConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const toggleMode = (mode: TelaoDisplayMode) => {
    setModes((cur) => (cur.includes(mode) ? cur.filter((m) => m !== mode) : [...cur, mode]));
  };

  const reset = () => setConfig(DEFAULT_TELAO_CONFIG);

  return (
    <div className="grid lg:grid-cols-[1fr_440px] gap-6">
      {/* LEFT: settings stack */}
      <div className="space-y-6 min-w-0">
        {/* 0. Quick open */}
        <Card className="bg-primary/5 border-primary/20">
          <h3 className="font-display text-lg text-ink mb-1">Abrir telão agora</h3>
          <p className="text-sm text-ink/60 mb-4">
            Atalhos rápidos pra abrir o telão sem precisar montar configuração.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`${publicTelaoUrl}?mode=fullscreen&fullscreen=1`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md font-medium bg-primary text-paper hover:bg-primary-deep"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Tela cheia (fullscreen)
            </a>
            <a
              href={`${publicTelaoUrl}?mode=browser_source`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md font-medium border border-ink/20 text-ink hover:bg-ink/5"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v18M3 12h18" opacity="0.5" />
              </svg>
              Browser Source (transparente)
            </a>
          </div>
        </Card>

        {/* 1. Diagnostic test */}
        <DiagnosticTestCard eventId={eventId} />

        {/* 1. Modes */}
        <Card>
          <h3 className="font-display text-lg mb-1">Modos de exibição habilitados</h3>
          <p className="text-sm text-ink/60 mb-4">
            Escolha um ou mais modos. Pode usar todos em paralelo. As configurações específicas de
            cada modo aparecem abaixo.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {ALL_MODES.map((mode) => (
              <label
                key={mode}
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
                  modes.includes(mode)
                    ? 'border-primary bg-primary/5'
                    : 'border-ink/15 hover:border-ink/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={modes.includes(mode)}
                  onChange={() => toggleMode(mode)}
                  className="mt-1 h-4 w-4"
                />
                <div className="text-sm">
                  <p className="font-medium text-ink">{DISPLAY_MODE_LABELS[mode]}</p>
                  <p className="text-xs text-ink/55 mt-0.5">{describeMode(mode)}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* 2. Mode-specific settings + instructions
            H2R Graphics e Janela Flutuante Chrome (PiP) removidos da UI a
            pedido do operador — só Browser Source e Audience Desktop ficam. */}

        {modes.includes('browser_source') ? (
          <BrowserSourceCard slug={slug} url={`${publicTelaoUrl}?mode=browser_source`} />
        ) : null}

        {modes.includes('desktop_app') ? (
          <ModeCard
            title="Audience Desktop"
            url={publicTelaoUrl}
            instructions={[
              'Baixe o app Audience Desktop pro seu sistema (Mac/Windows/Linux).',
              `Abra o app, cole o slug do evento (${slug}) e clique Conectar.`,
              'Posicione a janela transparente onde quiser na tela.',
              'Inicie sua apresentação — a janela permanece por cima.',
            ]}
            extraButtons={[
              {
                label: '⬇ Baixar (Mac · Apple Silicon)',
                href: 'https://github.com/davialvescine/audience/releases/latest/download/Audience.Desktop_aarch64.dmg',
              },
              {
                label: '⬇ Baixar (Mac · Intel)',
                href: 'https://github.com/davialvescine/audience/releases/latest/download/Audience.Desktop_x64.dmg',
              },
              {
                label: '⬇ Baixar (Windows)',
                href: 'https://github.com/davialvescine/audience/releases/latest/download/Audience.Desktop_x64.exe',
              },
            ]}
          />
        ) : null}

        {/* 3. Visual editor */}
        <Card className="space-y-6">
          <div>
            <h3 className="font-display text-lg">Aparência do telão</h3>
            <p className="text-sm text-ink/60 mt-1">
              Tudo que você muda aqui aparece no preview ao lado em tempo real. Salve no final pra
              aplicar de verdade.
            </p>
          </div>

          {/* Per-mode editing selector */}
          <div className="rounded-lg bg-ink/[0.03] dark:bg-ink/[0.08] p-3">
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">
              Editando configuração
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(['global', ...ALL_MODES] as EditingMode[]).map((m) => {
                const label = m === 'global' ? 'Global (padrão)' : MODE_SHORT_LABELS[m];
                const hasOverride = m !== 'global' && overrides[m] !== undefined;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditingMode(m)}
                    className={`px-3 h-8 rounded-md text-xs border transition inline-flex items-center gap-1.5 ${
                      editingMode === m
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-ink/15 text-ink/60 hover:border-ink/30'
                    }`}
                  >
                    <span>{label}</span>
                    {hasOverride ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                  </button>
                );
              })}
            </div>
            {editingMode !== 'global' ? (
              <div className="mt-3 flex items-center gap-2 text-xs">
                {!isOverrideActive ? (
                  <span className="text-ink/60">
                    Herda do <strong>Global</strong>. Mexa em qualquer controle pra criar um
                    override só pra <strong>{MODE_SHORT_LABELS[editingMode]}</strong>.
                  </span>
                ) : (
                  <>
                    <span className="text-accent">●</span>
                    <span className="text-ink/70">
                      Override ativo pra <strong>{MODE_SHORT_LABELS[editingMode]}</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setOverrides((prev) => {
                          const next = { ...prev };
                          delete next[editingMode];
                          return next;
                        })
                      }
                      className="ml-auto text-primary hover:underline"
                    >
                      Resetar pro Global
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>

          {/* Width / Height */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider
              label="Largura"
              suffix="%"
              min={20}
              max={100}
              value={config.widthPct}
              onChange={(v) => updateField('widthPct', v)}
            />
            <div>
              <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
                <span>Altura</span>
                <span className="text-ink font-medium">
                  {config.heightPx === 0 ? 'Auto' : `${config.heightPx}px`}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={500}
                value={config.heightPx}
                onChange={(e) => updateField('heightPx', Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-ink/45 mt-1">0 = auto (encaixa no texto)</p>
            </div>
          </div>

          {/* Font size */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider
              label="Tamanho da fonte"
              suffix="px"
              min={5}
              max={120}
              value={config.fontSizePx}
              onChange={(v) => updateField('fontSizePx', v)}
            />
          </div>

          {/* Colors */}
          <div className="grid sm:grid-cols-2 gap-4">
            <ColorInput
              label="Fundo do card"
              value={config.cardBg}
              onChange={(v) => updateField('cardBg', v)}
            />
            <ColorInput
              label="Cor do texto"
              value={config.cardText}
              onChange={(v) => updateField('cardText', v)}
            />
          </div>

          {/* Radius / Blur */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider
              label="Arredondamento"
              suffix="px"
              min={0}
              max={40}
              value={config.borderRadius}
              onChange={(v) => updateField('borderRadius', v)}
            />
            <Slider
              label="Blur do fundo"
              suffix="px"
              min={0}
              max={30}
              value={config.backdropBlur}
              onChange={(v) => updateField('backdropBlur', v)}
            />
          </div>

          {/* Shadow */}
          <PresetGroup
            label="Sombra"
            options={SHADOWS}
            value={config.shadow}
            onChange={(v) => updateField('shadow', v)}
          />

          {/* Animation */}
          <PresetGroup
            label="Animação de entrada"
            options={ANIMATIONS}
            value={config.animation}
            onChange={(v) => updateField('animation', v)}
            iconFor={(o) => ANIMATION_ICON[o]}
          />
          <p className="text-xs text-ink/50 -mt-3">
            Passe o mouse em <strong>▶ Tocar entrada e saída</strong> no preview pra ver a animação
            completa.
          </p>

          {/* Timing */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Slider
              label="Tempo de exibição"
              suffix="s"
              min={3}
              max={30}
              value={config.displaySeconds}
              onChange={(v) => updateField('displaySeconds', v)}
            />
            <IntervalSlider eventId={eventId} initial={h2r.dispatchIntervalSeconds} />
            <Slider
              label="Cards visíveis"
              suffix=""
              min={1}
              max={5}
              value={config.maxConcurrent}
              onChange={(v) => updateField('maxConcurrent', v)}
            />
          </div>
          <p className="text-xs text-ink/55 -mt-3">
            Mais de 1 = empilhadas verticalmente na mesma posição. Útil pra mostrar histórico
            recente.
          </p>

          {/* Modo de transicao */}
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Modo de transição</p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => updateField('transitionMode', 'sequential')}
                className={`px-3 h-9 rounded-md text-sm border transition text-left ${
                  config.transitionMode === 'sequential'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-ink/15 text-ink/70 hover:border-ink/30'
                }`}
              >
                <span className="block font-medium">Sequencial</span>
                <span className="block text-[10px] opacity-70">
                  sai → intervalo → entra próxima
                </span>
              </button>
              <button
                type="button"
                onClick={() => updateField('transitionMode', 'overlap')}
                className={`px-3 h-9 rounded-md text-sm border transition text-left ${
                  config.transitionMode === 'overlap'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-ink/15 text-ink/70 hover:border-ink/30'
                }`}
              >
                <span className="block font-medium">Em fila (rolagem)</span>
                <span className="block text-[10px] opacity-70">
                  enche até o limite, troca conforme sai
                </span>
              </button>
            </div>
          </div>

          {/* Extras */}
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Mostrar no card</p>
            <div className="flex gap-4 flex-wrap text-sm text-ink/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showTimestamp}
                  onChange={(e) => updateField('showTimestamp', e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Hora do envio</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showEventName}
                  onChange={(e) => updateField('showEventName', e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Nome do evento</span>
              </label>
            </div>
          </div>

          {/* Auto-save status bar */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-ink/10">
            <div className="text-sm text-ink/60 flex items-center gap-2">
              {autoSaveStatus === 'saving' ? (
                <>
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-ink/40 border-t-transparent animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : autoSaveStatus === 'saved' ? (
                <span className="text-success">✓ Salvo automaticamente</span>
              ) : autoSaveStatus === 'error' ? (
                <span className="text-danger">✗ Erro ao salvar — verifique a conexão</span>
              ) : dirty ? (
                <span className="text-ink/50">Mudanças não salvas — salvarão em 1s</span>
              ) : (
                <span className="text-ink/45">Tudo salvo</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Resetar pro padrão
            </Button>
          </div>
        </Card>
      </div>

      {/* RIGHT: sticky live preview */}
      <div className="lg:sticky lg:top-4 self-start">
        <Card>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-display text-lg">Preview ao vivo</h3>
            <div className="flex items-center gap-2">
              {(typeof config.posXPct === 'number' || typeof config.posYPct === 'number') && (
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({ ...c, posXPct: undefined, posYPct: undefined }))
                  }
                  className="text-xs px-3 h-8 inline-flex items-center rounded-md border border-ink/15 text-ink/70 hover:border-ink/30 transition"
                  title="Volta pra posição padrão (centro inferior)"
                >
                  Resetar posição
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: 'telao-play-cycle' },
                    window.location.origin,
                  )
                }
                className="text-xs px-3 h-8 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition"
                title="Tocar animação de entrada e saída"
              >
                ▶ Cycle
              </button>
              <button
                type="button"
                onClick={() =>
                  iframeRef.current?.contentWindow?.postMessage(
                    {
                      type: 'telao-play-queue',
                      intervalSeconds: h2r.dispatchIntervalSeconds,
                      samples: SAMPLE_PRESETS.map((p) => ({ name: p.name, comment: p.comment })),
                    },
                    window.location.origin,
                  )
                }
                className="text-xs px-3 h-8 inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 hover:bg-accent/15 text-accent transition"
                title="Simula uma fila com 4 mensagens (testa transição, intervalo, cards visíveis)"
              >
                ▶▶ Tocar fila
              </button>
            </div>
          </div>
          <p className="text-xs text-ink/55 mb-3">
            🖱️ <strong>Arraste o card</strong> dentro do preview pra posicionar onde quiser. A
            posição é em coordenadas reais de 1920×1080, então o que você vê aqui é exatamente o que
            vai pro OBS / vMix / projetor.
          </p>
          <div
            ref={previewBoxRef}
            className="aspect-video bg-gradient-to-br from-slate-100 via-white to-slate-200 rounded-lg overflow-hidden relative ring-1 ring-ink/10"
          >
            <div className="absolute inset-0 flex items-center justify-center text-ink/30 text-xs uppercase tracking-wider pointer-events-none select-none">
              [SUA APRESENTAÇÃO AQUI]
            </div>
            {/* Render iframe at 1920x1080 so the preview matches OBS/vMix
                output exactly, then CSS-scale to fit the container width. */}
            <iframe
              ref={iframeRef}
              src={`/telao/${slug}?preview=1`}
              width={1920}
              height={1080}
              className="absolute top-0 left-0 origin-top-left border-0"
              style={{
                width: 1920,
                height: 1080,
                transform: `scale(${previewScale})`,
              }}
              title="Preview do telão"
            />
          </div>
          <p className="mt-3 text-xs text-ink/55">
            O preview reflete tudo que você muda nos controles. Salve pra aplicar no telão real.
          </p>

          <div className="mt-4 pt-4 border-t border-ink/10 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-ink/60">Texto de teste</p>
              <div className="flex gap-1">
                {SAMPLE_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSample({ name: preset.name, comment: preset.comment })}
                    className="text-[11px] h-7 px-2 rounded-md border border-ink/15 text-ink/60 hover:border-ink/30 hover:text-ink transition"
                    title={`Trocar exemplo: ${preset.label}`}
                  >
                    {i + 1}. {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={sample.name}
              onChange={(e) => setSample((s) => ({ ...s, name: e.target.value }))}
              placeholder="Nome de quem envia"
              className="w-full h-9 px-3 rounded-md border border-ink/20 bg-paper text-ink text-sm"
            />
            <textarea
              value={sample.comment}
              onChange={(e) => setSample((s) => ({ ...s, comment: e.target.value }))}
              placeholder="Mensagem de teste"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-ink/20 bg-paper text-ink text-sm resize-none"
            />
            <p className="text-xs text-ink/50">
              Troca os presets pra ver como mensagens curtas/longas ficam com sua config.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Diagnostic test card ────────────────────────────────────────

function DiagnosticTestCard({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const fire = async () => {
    setStatus('sending');
    setMessage(null);
    try {
      const { dispatchDiagnosticTest, deleteDiagnosticTest } =
        await import('@/server-actions/diagnosticTest');
      const r = await dispatchDiagnosticTest(eventId);
      if (!r.ok) throw new Error(r.error);
      setStatus('sent');
      setMessage('Disparado. Em até 3s aparece no telão.');
      // Auto-cleanup: remove a row de teste 15s depois.
      setTimeout(() => {
        void deleteDiagnosticTest(r.submissionId);
      }, 15_000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'erro desconhecido');
    }
  };

  return (
    <Card>
      <h3 className="font-display text-lg mb-1">🔧 Teste de conexão</h3>
      <p className="text-sm text-ink/60 mb-3">
        Insere uma submission marcada como diagnóstico no banco. Em até 3s o telão (OBS, vMix, PiP,
        qualquer modo aberto) deve mostrar. A linha é removida automaticamente do banco após 15s. Se
        não aparecer no telão, o problema é na URL/conexão dele.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={fire} loading={status === 'sending'}>
          Disparar mensagem teste
        </Button>
        {status === 'sent' ? (
          <span className="text-sm text-success">✓ {message}</span>
        ) : status === 'error' ? (
          <span className="text-sm text-danger">✗ {message}</span>
        ) : null}
      </div>
      <p className="text-xs text-ink/50 mt-3">
        Antes de clicar, abra a URL do telão (ex.:{' '}
        <code className="font-mono text-[11px]">?mode=browser_source</code>) numa aba ou no OBS. A
        mensagem deve sumir após uns segundos.
      </p>
    </Card>
  );
}

// ── Helper inputs ────────────────────────────────────────────────

// Slider auto-save pro intervalo entre disparos (event-level setting,
// nao parte do telao_config). Debounce de 500ms pra nao spammar o
// server action.
function IntervalSlider({ eventId, initial }: { eventId: string; initial: number }) {
  const [value, setValue] = useState(initial);
  const [savedValue, setSavedValue] = useState(initial);
  useEffect(() => {
    if (value === savedValue) return;
    const t = setTimeout(() => {
      void updateDispatchInterval(eventId, value).then((r) => {
        if (r.ok) setSavedValue(value);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [value, savedValue, eventId]);
  return (
    <Slider
      label="Intervalo de exibição"
      suffix="s"
      min={1}
      max={30}
      value={value}
      onChange={setValue}
    />
  );
}

const ANIMATION_ICON: Record<TelaoAnimation, string> = {
  'slide-up': '↑',
  'slide-down': '↓',
  'slide-left': '←',
  'slide-right': '→',
  fade: '◐',
  scale: '⊕',
  bounce: '↕',
};

// ── Helpers (modes) ──────────────────────────────────────────────

function describeMode(mode: TelaoDisplayMode): string {
  switch (mode) {
    case 'h2r':
      return 'Sistema clássico H2R Graphics. Requer o app desktop e bridge CLI.';
    case 'browser_source':
      return 'Funciona em OBS, vMix, Streamlabs, Wirecast — qualquer software com Browser Source.';
    case 'chrome_pip':
      return 'Janela flutuante always-on-top no Chrome. 1 clique pra ativar, sem instalação.';
    case 'desktop_app':
      return 'App proprietário Audience Desktop — janela transparente always-on-top, sem precisar de OBS.';
  }
}

function BrowserSourceCard({ slug, url }: { slug: string; url: string }) {
  return (
    <Card>
      <h4 className="font-display text-base text-ink mb-1">Browser Source</h4>
      <p className="text-sm text-ink/60 mb-4">
        Funciona em qualquer software com suporte a "Browser Source": OBS, vMix, Streamlabs,
        Wirecast, Ecamm, mimoLive.
      </p>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">
          URL pra colar no software
        </p>
        <CopyableField value={url} label="URL do telão" />
      </div>

      {/* Two-path explainer */}
      <div className="mb-5 grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wide text-primary font-bold mb-2">
            Caminho rápido
          </p>
          <p className="font-medium text-ink text-sm mb-1.5">📥 Baixar cena pronta</p>
          <p className="text-xs text-ink/70 leading-relaxed mb-2">
            Baixe o arquivo do software (OBS, vMix, Streamlabs) abaixo. Abra o programa, vá em
            <strong> Cena → Importar Coleção de Cenas</strong> e escolha o arquivo. A cena já vem
            com URL, tamanho e CSS configurados.
          </p>
          <p className="text-xs text-ink/55 italic">
            ⚡ Pronto em 30s · Recomendado pra OBS e Streamlabs
          </p>
        </div>
        <div className="rounded-lg border border-ink/15 bg-ink/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-ink/65 font-bold mb-2">
            Caminho manual
          </p>
          <p className="font-medium text-ink text-sm mb-1.5">📋 Copiar URL e configurar</p>
          <p className="text-xs text-ink/70 leading-relaxed mb-2">
            Copie a URL acima. No software: <strong>Add Source → Browser Source</strong> · cola a
            URL · define <strong>Width 1920</strong> · <strong>Height 1080</strong> · Custom CSS:
            <code className="block mt-1 text-[10px] bg-ink/10 px-2 py-1 rounded font-mono break-all">
              body {'{'} background: transparent !important; margin: 0; {'}'}
            </code>
          </p>
          <p className="text-xs text-ink/55 italic">
            🔧 Funciona em qualquer software · Útil pra Wirecast, Ecamm, mimoLive
          </p>
        </div>
      </div>

      <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Software de produção</p>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <SoftwareCell
          name="OBS Studio"
          downloadHref="https://obsproject.com/download"
          sceneHref={`/api/scene/obs/${slug}`}
          sceneLabel="Cena pronta (.json)"
        />
        <SoftwareCell
          name="vMix"
          downloadHref="https://www.vmix.com/software/download.aspx"
          sceneHref={`/api/scene/vmix/${slug}`}
          sceneLabel="Preset (.vmix)"
        />
        <SoftwareCell
          name="Streamlabs"
          downloadHref="https://streamlabs.com/streamlabs-desktop"
          sceneHref={`/api/scene/streamlabs/${slug}`}
          sceneLabel="Cena pronta (.json)"
        />
      </div>

      <details className="text-sm text-ink/75">
        <summary className="cursor-pointer text-ink/80 font-medium mb-2 hover:text-primary">
          Passo a passo no OBS (caminho rápido)
        </summary>
        <ol className="list-decimal list-inside space-y-1 mt-2 pl-2">
          <li>Baixe o OBS Studio acima e instale (grátis).</li>
          <li>
            Abra o OBS. Menu <strong>Cena → Importar Coleção de Cenas</strong>.
          </li>
          <li>
            Escolha o arquivo <code className="text-xs">audience-{slug}-obs.json</code> que você
            baixou.
          </li>
          <li>
            Adicione sua apresentação como <strong>Captura de Janela</strong>{' '}
            (PowerPoint/Keynote/Chrome).
          </li>
          <li>
            Coloque a apresentação <strong>abaixo</strong> da fonte "Audience Comentários" na lista
            de fontes.
          </li>
          <li>
            Clique direito no preview → <strong>Projetor de Tela Cheia (Programa)</strong> → escolha
            o monitor do projetor.
          </li>
        </ol>
      </details>

      <details className="text-sm text-ink/75 mt-2">
        <summary className="cursor-pointer text-ink/80 font-medium mb-2 hover:text-primary">
          vMix · Streamlabs · Wirecast · Outros (caminho manual)
        </summary>
        <div className="mt-2 pl-2 space-y-2">
          <p>
            <strong>vMix:</strong> Add Input → Web Browser → cola a URL · Width 1920 · Height 1080.
            Ou File → Open Preset com o <code className="text-xs">.vmix</code> baixado.
          </p>
          <p>
            <strong>Streamlabs Desktop:</strong> Add Source → Browser Source → cola a URL · ou
            importa a cena <code className="text-xs">.json</code> baixada.
          </p>
          <p>
            <strong>Wirecast:</strong> New Source → Web Page → cola a URL · adiciona como Layer
            acima da apresentação.
          </p>
          <p>
            <strong>Ecamm Live (Mac):</strong> Source → Web Page → cola a URL.
          </p>
          <p>
            <strong>mimoLive:</strong> Add Source → Web Page → cola a URL.
          </p>
        </div>
      </details>
    </Card>
  );
}

function SoftwareCell({
  name,
  downloadHref,
  sceneHref,
  sceneLabel,
}: {
  name: string;
  downloadHref: string;
  sceneHref: string;
  sceneLabel: string;
}) {
  return (
    <div className="rounded-md border border-ink/10 bg-ink/5 p-3">
      <p className="font-medium text-sm text-ink mb-2">{name}</p>
      <a
        href={downloadHref}
        target="_blank"
        rel="noreferrer"
        className="block text-xs text-primary hover:underline mb-1.5"
      >
        ↗ Baixar {name}
      </a>
      <a href={sceneHref} download className="block text-xs text-primary hover:underline">
        📥 {sceneLabel}
      </a>
    </div>
  );
}

function ModeCard({
  title,
  url,
  instructions,
  extraButtons,
}: {
  title: string;
  url: string;
  instructions: string[];
  extraButtons?: Array<{ label: string; href: string; disabled?: boolean }>;
}) {
  return (
    <Card>
      <h4 className="font-display text-base text-ink mb-3">{title}</h4>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">
          URL pra colar no software
        </p>
        <CopyableField value={url} label="URL do telão" />
      </div>

      <ol className="list-decimal list-inside space-y-1 text-sm text-ink/75">
        {instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {extraButtons && extraButtons.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          {extraButtons.map((b) =>
            b.disabled ? (
              <span
                key={b.label}
                className="text-xs px-3 h-9 inline-flex items-center rounded-md bg-ink/5 text-ink/40"
              >
                {b.label}
              </span>
            ) : (
              <a
                key={b.label}
                href={b.href}
                download
                className="text-xs px-3 h-9 inline-flex items-center rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
              >
                📥 {b.label}
              </a>
            ),
          )}
        </div>
      ) : null}
    </Card>
  );
}
