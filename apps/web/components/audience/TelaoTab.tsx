'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  DEFAULT_TELAO_CONFIG,
  DISPLAY_MODE_LABELS,
  type TelaoAnimation,
  type TelaoConfig,
  type TelaoDisplayMode,
  type TelaoPosition,
  type TelaoShadow,
} from '@/lib/telao/config';
import { updateDisplayModes, updateTelaoConfig } from '@/server-actions/telao';

const POSITIONS: TelaoPosition[] = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const ANIMATIONS: TelaoAnimation[] = ['slide-up', 'slide-down', 'slide-left', 'slide-right', 'fade', 'scale', 'bounce'];
const SHADOWS: TelaoShadow[] = ['none', 'subtle', 'medium', 'dramatic'];
const ALL_MODES: TelaoDisplayMode[] = ['h2r', 'browser_source', 'chrome_pip', 'desktop_app'];

type Props = {
  eventId: string;
  slug: string;
  initialConfig: TelaoConfig;
  initialModes: TelaoDisplayMode[];
  publicTelaoUrl: string;
};

export function TelaoTab({ eventId, slug, initialConfig, initialModes, publicTelaoUrl }: Props) {
  const [config, setConfig] = useState<TelaoConfig>(initialConfig);
  const [modes, setModes] = useState<TelaoDisplayMode[]>(initialModes);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const dirty =
    JSON.stringify(config) !== JSON.stringify(initialConfig) ||
    JSON.stringify([...modes].sort()) !== JSON.stringify([...initialModes].sort());

  const updateField = <K extends keyof TelaoConfig>(key: K, value: TelaoConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const toggleMode = (mode: TelaoDisplayMode) => {
    setModes((cur) => (cur.includes(mode) ? cur.filter((m) => m !== mode) : [...cur, mode]));
  };

  const save = () => {
    start(async () => {
      const r1 = await updateTelaoConfig(eventId, config);
      const r2 = await updateDisplayModes(eventId, modes);
      if (r1.ok && r2.ok) {
        setFeedback('✓ Salvo');
        setPreviewKey((k) => k + 1);
      } else {
        setFeedback('✗ Erro ao salvar');
      }
      setTimeout(() => setFeedback(null), 3000);
    });
  };

  const reset = () => setConfig(DEFAULT_TELAO_CONFIG);

  return (
    <div className="space-y-6">
      {/* Modes selector */}
      <Card>
        <h3 className="font-display text-lg mb-1">Modos de exibição habilitados</h3>
        <p className="text-sm text-ink/60 mb-4">
          Escolha um ou mais modos. Pode usar todos em paralelo.
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

      {/* Editor + Preview side-by-side */}
      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        {/* Editor */}
        <Card className="space-y-6">
          <h3 className="font-display text-lg">Aparência do telão</h3>

          {/* Position */}
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Posição na tela</p>
            <div className="grid grid-cols-3 gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateField('position', p)}
                  className={`h-12 rounded border text-xs transition ${
                    config.position === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-ink/15 text-ink/50 hover:border-ink/30'
                  }`}
                  title={p}
                >
                  {positionIcon(p)}
                </button>
              ))}
            </div>
          </div>

          {/* Width */}
          <div>
            <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
              <span>Largura</span>
              <span className="text-ink font-medium">{config.widthPct}%</span>
            </label>
            <input
              type="range"
              min={20}
              max={100}
              value={config.widthPct}
              onChange={(e) => updateField('widthPct', Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Font size */}
          <div>
            <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
              <span>Tamanho da fonte</span>
              <span className="text-ink font-medium">{config.fontSizePx}px</span>
            </label>
            <input
              type="range"
              min={14}
              max={80}
              value={config.fontSizePx}
              onChange={(e) => updateField('fontSizePx', Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Fundo do card</p>
              <input
                type="text"
                value={config.cardBg}
                onChange={(e) => updateField('cardBg', e.target.value)}
                className="w-full h-10 px-2 rounded-md border border-ink/20 bg-paper text-ink text-xs font-mono"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Cor do texto</p>
              <input
                type="text"
                value={config.cardText}
                onChange={(e) => updateField('cardText', e.target.value)}
                className="w-full h-10 px-2 rounded-md border border-ink/20 bg-paper text-ink text-xs font-mono"
              />
            </div>
          </div>

          {/* Radius + Blur */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
                <span>Cantos</span>
                <span className="text-ink font-medium">{config.borderRadius}px</span>
              </label>
              <input
                type="range"
                min={0}
                max={40}
                value={config.borderRadius}
                onChange={(e) => updateField('borderRadius', Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
                <span>Blur</span>
                <span className="text-ink font-medium">{config.backdropBlur}px</span>
              </label>
              <input
                type="range"
                min={0}
                max={30}
                value={config.backdropBlur}
                onChange={(e) => updateField('backdropBlur', Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Shadow */}
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Sombra</p>
            <div className="flex gap-2 flex-wrap">
              {SHADOWS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateField('shadow', s)}
                  className={`px-3 h-9 rounded-md text-sm border transition ${
                    config.shadow === s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-ink/15 text-ink/60 hover:border-ink/30'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Animation */}
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Animação de entrada</p>
            <div className="flex gap-2 flex-wrap">
              {ANIMATIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => updateField('animation', a)}
                  className={`px-3 h-9 rounded-md text-sm border transition ${
                    config.animation === a
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-ink/15 text-ink/60 hover:border-ink/30'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Timing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
                <span>Tempo de exibição</span>
                <span className="text-ink font-medium">{config.displaySeconds}s</span>
              </label>
              <input
                type="range"
                min={3}
                max={30}
                value={config.displaySeconds}
                onChange={(e) => updateField('displaySeconds', Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-2">
                <span>Mensagens visíveis</span>
                <span className="text-ink font-medium">{config.maxConcurrent}</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={config.maxConcurrent}
                onChange={(e) => updateField('maxConcurrent', Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Extras */}
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Mostrar</p>
            <div className="flex gap-3 flex-wrap text-sm text-ink/80">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.showTimestamp} onChange={(e) => updateField('showTimestamp', e.target.checked)} />
                Hora
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config.showEventName} onChange={(e) => updateField('showEventName', e.target.checked)} />
                Nome do evento
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-ink/10">
            <Button loading={pending} disabled={!dirty} onClick={save}>
              Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Resetar
            </Button>
            {feedback ? <span className="text-sm text-ink/70">{feedback}</span> : null}
          </div>
        </Card>

        {/* Preview */}
        <Card className="lg:sticky lg:top-4 self-start">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">Preview ao vivo</h3>
            <button
              type="button"
              onClick={() => setPreviewKey((k) => k + 1)}
              className="text-xs text-primary hover:underline"
            >
              Recarregar
            </button>
          </div>
          <div className="aspect-video bg-gradient-to-br from-ink/80 via-primary-deep to-ink rounded-lg overflow-hidden relative">
            <div className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
              [SUA APRESENTAÇÃO AQUI]
            </div>
            <iframe
              key={previewKey}
              src={`/telao/${slug}?preview=1`}
              className="absolute inset-0 w-full h-full"
              title="Preview do telão"
            />
          </div>
          <p className="mt-3 text-xs text-ink/55">
            Salve as alterações pra ver o resultado atualizado.
          </p>
        </Card>
      </div>

      {/* Mode-specific instructions */}
      <div className="space-y-3">
        {modes.includes('browser_source') ? (
          <ModeCard
            title="Browser Source (OBS, vMix, Streamlabs, Wirecast)"
            url={publicTelaoUrl}
            instructions={[
              'Abra o software de transmissão (OBS Studio: obsproject.com — grátis).',
              'Crie uma nova cena e adicione "Browser Source" (ou "Web Browser" no vMix).',
              `Cole esta URL: ${publicTelaoUrl}`,
              'Defina largura 1920 e altura 1080.',
              'Adicione sua apresentação como Captura de Janela (PowerPoint/Keynote).',
              'Direito no preview → "Projetor de Tela Cheia" → escolha o monitor do projetor.',
            ]}
            extraButtons={[
              { label: 'Baixar cena pro OBS', href: `/api/scene/obs/${slug}` },
            ]}
          />
        ) : null}
        {modes.includes('chrome_pip') ? (
          <ModeCard
            title="Janela Flutuante Chrome"
            url={publicTelaoUrl}
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
      </div>
    </div>
  );
}

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

function positionIcon(p: TelaoPosition): string {
  const map: Record<TelaoPosition, string> = {
    'top-left': '↖',
    'top-center': '↑',
    'top-right': '↗',
    'middle-left': '←',
    'center': '·',
    'middle-right': '→',
    'bottom-left': '↙',
    'bottom-center': '↓',
    'bottom-right': '↘',
  };
  return map[p];
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
      <h4 className="font-display text-base text-ink mb-2">{title}</h4>
      <ol className="list-decimal list-inside space-y-1 text-sm text-ink/75">
        {instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(url)}
          className="text-xs px-3 h-9 rounded-md border border-ink/20 hover:border-primary/50 transition text-ink"
        >
          📋 Copiar URL
        </button>
        {extraButtons?.map((b) =>
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
    </Card>
  );
}
