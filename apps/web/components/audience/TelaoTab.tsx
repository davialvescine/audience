'use client';

import { useEffect, useRef, useState } from 'react';

import { DispatchIntervalForm } from '@/components/audience/DispatchIntervalForm';
import { PairingCodeDisplay } from '@/components/audience/PairingCodeDisplay';
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
import { updateDisplayModes, updateTelaoConfig } from '@/server-actions/telao';

const ANIMATIONS: TelaoAnimation[] = ['slide-up', 'slide-down', 'slide-left', 'slide-right', 'fade', 'scale', 'bounce'];
const SHADOWS: TelaoShadow[] = ['none', 'subtle', 'medium', 'dramatic'];
const ALL_MODES: TelaoDisplayMode[] = ['h2r', 'browser_source', 'chrome_pip', 'desktop_app'];

type Props = {
  eventId: string;
  slug: string;
  initialConfig: TelaoConfig;
  initialModes: TelaoDisplayMode[];
  publicTelaoUrl: string;
  h2r: {
    alreadyPaired: boolean;
    lastHeartbeat: string | null;
    dispatchIntervalSeconds: number;
  };
};

export function TelaoTab({
  eventId,
  slug,
  initialConfig,
  initialModes,
  publicTelaoUrl,
  h2r,
}: Props) {
  const [config, setConfig] = useState<TelaoConfig>(initialConfig);
  const [modes, setModes] = useState<TelaoDisplayMode[]>(initialModes);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
  const lastSavedRef = useRef({ config: initialConfig, modes: initialModes });

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

  // Debounced autosave: fires 600ms after the last config / modes change
  useEffect(() => {
    const cfgUnchanged = JSON.stringify(config) === JSON.stringify(lastSavedRef.current.config);
    const modesUnchanged =
      JSON.stringify([...modes].sort()) === JSON.stringify([...lastSavedRef.current.modes].sort());
    if (cfgUnchanged && modesUnchanged) return;

    const t = setTimeout(() => {
      setAutoSaveStatus('saving');
      void Promise.all([
        cfgUnchanged ? Promise.resolve({ ok: true } as const) : updateTelaoConfig(eventId, config),
        modesUnchanged ? Promise.resolve({ ok: true } as const) : updateDisplayModes(eventId, modes),
      ]).then(([r1, r2]) => {
        if (r1.ok && r2.ok) {
          lastSavedRef.current = { config, modes };
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 1500);
        } else {
          setAutoSaveStatus('error');
          setTimeout(() => setAutoSaveStatus('idle'), 3000);
        }
      });
    }, 600);

    return () => clearTimeout(t);
  }, [config, modes, eventId]);

  const dirty =
    JSON.stringify(config) !== JSON.stringify(lastSavedRef.current.config) ||
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
        {/* 0. Diagnostic test */}
        <DiagnosticTestCard eventId={eventId} />

        {/* 1. Modes */}
        <Card>
          <h3 className="font-display text-lg mb-1">Modos de exibição habilitados</h3>
          <p className="text-sm text-ink/60 mb-4">
            Escolha um ou mais modos. Pode usar todos em paralelo. As configurações específicas de cada modo aparecem abaixo.
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

        {/* 2. Mode-specific settings + instructions */}
        {modes.includes('h2r') ? (
          <Card>
            <div className="mb-3">
              <h3 className="font-display text-lg">H2R Graphics</h3>
              <p className="text-sm text-ink/60">Conexão e disparos pro app H2R.</p>
            </div>
            <div className="space-y-6">
              <PairingCodeDisplay
                eventId={eventId}
                alreadyPaired={h2r.alreadyPaired}
                lastHeartbeat={h2r.lastHeartbeat}
              />
              <div className="pt-6 border-t border-ink/10">
                <DispatchIntervalForm
                  eventId={eventId}
                  current={h2r.dispatchIntervalSeconds}
                />
              </div>
            </div>
          </Card>
        ) : null}

        {modes.includes('browser_source') ? (
          <BrowserSourceCard slug={slug} url={`${publicTelaoUrl}?mode=browser_source`} />
        ) : null}

        {modes.includes('chrome_pip') ? (
          <ModeCard
            title="Janela Flutuante Chrome"
            url={`${publicTelaoUrl}?mode=chrome_pip`}
            instructions={[
              'No computador da apresentação, abra o Google Chrome.',
              `Acesse: ${publicTelaoUrl}`,
              'Aparecerá um botão "Abrir como janela flutuante" — clique nele.',
              'Arraste a janela pro canto da tela onde quer que apareça.',
              'Inicie sua apresentação normalmente — a janela continua por cima.',
            ]}
          />
        ) : null}

        {modes.includes('desktop_app') ? (
          <ModeCard
            title="Audience Desktop"
            url={publicTelaoUrl}
            instructions={[
              'Em breve: app nativo Mac/Windows pra exibir o telão sem precisar de OBS.',
            ]}
            extraButtons={[
              { label: 'Em desenvolvimento', href: '#', disabled: true },
            ]}
          />
        ) : null}

        {/* 3. Visual editor */}
        <Card className="space-y-6">
          <div>
            <h3 className="font-display text-lg">Aparência do telão</h3>
            <p className="text-sm text-ink/60 mt-1">
              Tudo que você muda aqui aparece no preview ao lado em tempo real. Salve no final pra aplicar de verdade.
            </p>
          </div>

          {/* Width / Height */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider label="Largura" suffix="%" min={20} max={100} value={config.widthPct} onChange={(v) => updateField('widthPct', v)} />
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
            <Slider label="Tamanho da fonte" suffix="px" min={5} max={120} value={config.fontSizePx} onChange={(v) => updateField('fontSizePx', v)} />
          </div>

          {/* Colors */}
          <div className="grid sm:grid-cols-2 gap-4">
            <ColorInput label="Fundo do card" value={config.cardBg} onChange={(v) => updateField('cardBg', v)} />
            <ColorInput label="Cor do texto" value={config.cardText} onChange={(v) => updateField('cardText', v)} />
          </div>

          {/* Radius / Blur */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider label="Arredondamento" suffix="px" min={0} max={40} value={config.borderRadius} onChange={(v) => updateField('borderRadius', v)} />
            <Slider label="Blur do fundo" suffix="px" min={0} max={30} value={config.backdropBlur} onChange={(v) => updateField('backdropBlur', v)} />
          </div>

          {/* Shadow */}
          <PresetGroup label="Sombra" options={SHADOWS} value={config.shadow} onChange={(v) => updateField('shadow', v)} />

          {/* Animation */}
          <PresetGroup
            label="Animação de entrada"
            options={ANIMATIONS}
            value={config.animation}
            onChange={(v) => updateField('animation', v)}
            iconFor={(o) => ANIMATION_ICON[o]}
          />
          <p className="text-xs text-ink/50 -mt-3">
            Passe o mouse em <strong>▶ Tocar entrada e saída</strong> no preview pra ver a animação completa.
          </p>

          {/* Timing */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Slider label="Tempo de exibição" suffix="s" min={3} max={30} value={config.displaySeconds} onChange={(v) => updateField('displaySeconds', v)} />
            <Slider label="Mensagens visíveis" suffix="" min={1} max={5} value={config.maxConcurrent} onChange={(v) => updateField('maxConcurrent', v)} />
          </div>

          {/* Extras */}
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Mostrar no card</p>
            <div className="flex gap-4 flex-wrap text-sm text-ink/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.showTimestamp} onChange={(e) => updateField('showTimestamp', e.target.checked)} className="h-4 w-4" />
                <span>Hora do envio</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.showEventName} onChange={(e) => updateField('showEventName', e.target.checked)} className="h-4 w-4" />
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
              {(typeof config.posXPct === 'number' ||
                typeof config.posYPct === 'number') && (
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
                ▶ Tocar entrada e saída
              </button>
            </div>
          </div>
          <p className="text-xs text-ink/55 mb-3">
            🖱️ <strong>Arraste o card</strong> dentro do preview pra posicionar onde quiser. A
            posição é em coordenadas reais de 1920×1080, então o que você vê aqui é exatamente
            o que vai pro OBS / vMix / projetor.
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
            <p className="text-xs uppercase tracking-wide text-ink/60">Texto de teste</p>
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
              Use pra ver como mensagens reais ficam com a configuração escolhida.
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
      const supabase = getSupabaseBrowserClient();
      // httpSend() posts to /realtime/v1/api/broadcast directly — no WebSocket
      // subscribe required. Avoids CHANNEL_ERROR from the WS path while still
      // delivering to subscribed listeners on the same topic.
      const channel = supabase.channel(`telao:${eventId}`, {
        config: { broadcast: { self: false } },
      });
      const result = await channel.httpSend('test_message', {
        name: 'TESTE DE DIAGNÓSTICO',
        comment: `Telão funcionando — ${new Date().toLocaleTimeString('pt-BR')}`,
      });
      await supabase.removeChannel(channel);
      if (!result.success) {
        throw new Error(`broadcast falhou (${result.status}): ${result.error}`);
      }
      setStatus('sent');
      setMessage('Disparado. Se aparecer no telão, o canal Realtime tá ok.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'erro desconhecido');
    }
  };

  return (
    <Card>
      <h3 className="font-display text-lg mb-1">🔧 Teste de conexão</h3>
      <p className="text-sm text-ink/60 mb-3">
        Dispara uma mensagem fixa pelo canal Realtime — sem passar pelo banco. Se aparecer no
        telão (OBS, vMix, PiP, qualquer modo aberto), a URL tá funcionando. Se não aparecer,
        o problema é na conexão entre a tela e o servidor.
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
        <code className="font-mono text-[11px]">?mode=browser_source</code>) numa aba ou no
        OBS. A mensagem deve sumir após uns segundos.
      </p>
    </Card>
  );
}

// ── Helper inputs ────────────────────────────────────────────────

function Slider({
  label,
  suffix,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
        <span>{label}</span>
        <span className="text-ink font-medium">
          {value}{suffix}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">{label}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-10 px-2 rounded-md border border-ink/20 bg-paper text-ink text-xs font-mono"
          placeholder="rgba(...) ou #..."
        />
        <input
          type="color"
          value={cssToHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-md border border-ink/20 cursor-pointer"
        />
      </div>
    </div>
  );
}

function PresetGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  iconFor,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  iconFor?: (o: T) => string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-3 h-9 rounded-md text-sm border transition inline-flex items-center gap-1.5 ${
              value === o
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-ink/15 text-ink/60 hover:border-ink/30'
            }`}
          >
            {iconFor && <span aria-hidden className="text-base leading-none">{iconFor(o)}</span>}
            <span>{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const ANIMATION_ICON: Record<TelaoAnimation, string> = {
  'slide-up': '↑',
  'slide-down': '↓',
  'slide-left': '←',
  'slide-right': '→',
  'fade': '◐',
  'scale': '⊕',
  'bounce': '↕',
};

// Fallback: extract first hex/rgb from arbitrary css color into a hex picker can show
function cssToHex(css: string): string {
  if (css.startsWith('#') && (css.length === 7 || css.length === 4)) return css;
  const rgbMatch = css.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${toHex(r!)}${toHex(g!)}${toHex(b!)}`;
  }
  return '#000000';
}

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
      return 'App proprietário Audience Desktop com janela transparente. Em desenvolvimento.';
  }
}

function BrowserSourceCard({ slug, url }: { slug: string; url: string }) {
  return (
    <Card>
      <h4 className="font-display text-base text-ink mb-1">Browser Source</h4>
      <p className="text-sm text-ink/60 mb-4">
        Funciona em qualquer software com suporte a "Browser Source": OBS, vMix, Streamlabs, Wirecast, Ecamm, mimoLive.
      </p>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">URL pra colar no software</p>
        <CopyableField value={url} label="URL do telão" />
      </div>

      {/* Two-path explainer */}
      <div className="mb-5 grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wide text-primary font-bold mb-2">Caminho rápido</p>
          <p className="font-medium text-ink text-sm mb-1.5">📥 Baixar cena pronta</p>
          <p className="text-xs text-ink/70 leading-relaxed mb-2">
            Baixe o arquivo do software (OBS, vMix, Streamlabs) abaixo. Abra o programa, vá em
            <strong> Cena → Importar Coleção de Cenas</strong> e escolha o arquivo. A cena já vem com URL,
            tamanho e CSS configurados.
          </p>
          <p className="text-xs text-ink/55 italic">
            ⚡ Pronto em 30s · Recomendado pra OBS e Streamlabs
          </p>
        </div>
        <div className="rounded-lg border border-ink/15 bg-ink/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-ink/65 font-bold mb-2">Caminho manual</p>
          <p className="font-medium text-ink text-sm mb-1.5">📋 Copiar URL e configurar</p>
          <p className="text-xs text-ink/70 leading-relaxed mb-2">
            Copie a URL acima. No software: <strong>Add Source → Browser Source</strong> · cola a URL ·
            define <strong>Width 1920</strong> · <strong>Height 1080</strong> · Custom CSS:
            <code className="block mt-1 text-[10px] bg-ink/10 px-2 py-1 rounded font-mono break-all">body {'{'} background: transparent !important; margin: 0; {'}'}</code>
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
          <li>Abra o OBS. Menu <strong>Cena → Importar Coleção de Cenas</strong>.</li>
          <li>Escolha o arquivo <code className="text-xs">audience-{slug}-obs.json</code> que você baixou.</li>
          <li>Adicione sua apresentação como <strong>Captura de Janela</strong> (PowerPoint/Keynote/Chrome).</li>
          <li>Coloque a apresentação <strong>abaixo</strong> da fonte "Audience Comentários" na lista de fontes.</li>
          <li>Clique direito no preview → <strong>Projetor de Tela Cheia (Programa)</strong> → escolha o monitor do projetor.</li>
        </ol>
      </details>

      <details className="text-sm text-ink/75 mt-2">
        <summary className="cursor-pointer text-ink/80 font-medium mb-2 hover:text-primary">
          vMix · Streamlabs · Wirecast · Outros (caminho manual)
        </summary>
        <div className="mt-2 pl-2 space-y-2">
          <p><strong>vMix:</strong> Add Input → Web Browser → cola a URL · Width 1920 · Height 1080. Ou File → Open Preset com o <code className="text-xs">.vmix</code> baixado.</p>
          <p><strong>Streamlabs Desktop:</strong> Add Source → Browser Source → cola a URL · ou importa a cena <code className="text-xs">.json</code> baixada.</p>
          <p><strong>Wirecast:</strong> New Source → Web Page → cola a URL · adiciona como Layer acima da apresentação.</p>
          <p><strong>Ecamm Live (Mac):</strong> Source → Web Page → cola a URL.</p>
          <p><strong>mimoLive:</strong> Add Source → Web Page → cola a URL.</p>
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
      <a
        href={sceneHref}
        download
        className="block text-xs text-primary hover:underline"
      >
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
        <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">URL pra colar no software</p>
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
              <span key={b.label} className="text-xs px-3 h-9 inline-flex items-center rounded-md bg-ink/5 text-ink/40">
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
