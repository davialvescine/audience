'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { Slide } from '@/lib/slides/types';
import { resetSlideWords } from '@/server-actions/slides';
import { uploadEventAsset } from '@/server-actions/uploadEventAsset';

type Props = {
  slide: Slide;
  onChange: (config: WordcloudConfig) => void;
  onLiveChange?: ((config: WordcloudConfig) => void) | undefined;
  onApplyToAll?: (() => void) | undefined;
};

const DEBOUNCE_MS = 500;

const PALETTE_LIGHT = [
  '#E63946',
  '#1D3557',
  '#2A9D8F',
  '#E76F51',
  '#6A4C93',
  '#0077B6',
  '#06A77D',
  '#D62828',
];
const PALETTE_DARK = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
  '#FCBAD3',
  '#A8E6CF',
];

export const BACKGROUND_PRESETS: Array<{ label: string; bg: WordcloudBackground; palette: string[] }> = [
  { label: 'Branco', bg: { type: 'color', value: '#FFFFFF' }, palette: PALETTE_LIGHT },
  { label: 'Escuro', bg: { type: 'color', value: '#0A2540' }, palette: PALETTE_DARK },
  {
    label: 'Sunset',
    bg: { type: 'gradient', from: '#FF6B6B', to: '#FFE66D' },
    palette: PALETTE_LIGHT,
  },
  {
    label: 'Ocean',
    bg: { type: 'gradient', from: '#0077B6', to: '#4ECDC4' },
    palette: PALETTE_DARK,
  },
  {
    label: 'Forest',
    bg: { type: 'gradient', from: '#06A77D', to: '#1D3557' },
    palette: PALETTE_DARK,
  },
  {
    label: 'Purple',
    bg: { type: 'gradient', from: '#6A4C93', to: '#E63946' },
    palette: PALETTE_DARK,
  },
];

export function SlidePropsPanel({ slide, onChange, onLiveChange, onApplyToAll }: Props) {
  const initial = slide.config as WordcloudConfig;
  const [config, setConfig] = useState<WordcloudConfig>(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(true);

  // Ressincroniza local state quando slide muda E quando slide.config muda
  // via realtime (ex: toggle de QR/ocultar no telão chega via channel).
  // Sem ressincronizar, autosave continuaria salvando a config velha,
  // sobrescrevendo mudanças do operador.
  useEffect(() => {
    setConfig(slide.config as WordcloudConfig);
    skipNext.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id, JSON.stringify(slide.config)]);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    onLiveChange?.(config);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(config), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Dep só de `config` — onChange/onLiveChange devem ser estáveis (useCallback
    // no SlidesTab). Se entrassem nas deps, cada re-render do parent re-dispara
    // autosave e cria loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const setBg = (bg: WordcloudBackground) => setConfig((c) => ({ ...c, background: bg }));
  const bg = (config.background ?? { type: 'none' }) as WordcloudBackground;
  const [tab, setTab] = useState<'conteudo' | 'design' | 'avancado'>('conteudo');

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-full bg-ink/[0.05] p-1 sticky top-0 z-10">
        {(
          [
            { id: 'conteudo' as const, label: 'Conteúdo' },
            { id: 'design' as const, label: 'Design' },
            { id: 'avancado' as const, label: 'Avançado' },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 h-8 rounded-full text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-paper text-ink shadow-sm'
                : 'text-ink/55 hover:text-ink/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3" hidden={tab !== 'conteudo'}>
      <Section title="Tipo da pergunta">
        <div className="relative">
          <select
            className="w-full h-10 rounded-md border border-ink/20 bg-paper text-sm px-3 pr-8 appearance-none cursor-pointer"
            value={slide.type}
            disabled
          >
            <option value="wordcloud">☁ Nuvem de palavras</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none">
            ▾
          </span>
        </div>
        <p className="text-[11px] text-ink/55">
          Outros tipos (enquete, pergunta livre, quiz) chegam em breve.
        </p>
      </Section>

      <Section title="Pergunta">
        <Input
          label=""
          id={`q-${slide.id}`}
          value={config.question}
          onChange={(e) => setConfig((c) => ({ ...c, question: e.target.value }))}
          maxLength={140}
          placeholder="O que você quer perguntar?"
        />
      </Section>

      <Section title="Configurações de resposta">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink">Palavras por envio</span>
          <select
            value={config.maxWordsPerSubmission}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                maxWordsPerSubmission: Number(e.target.value) as 1 | 2 | 3,
              }))
            }
            className="h-9 rounded-md border border-ink/20 bg-paper text-sm px-2"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      </Section>

      <Section title="Mostrar respostas" live>
        <Radio
          name="showResponses"
          value="instant"
          current={config.showResponsesMode ?? 'instant'}
          onChange={(v) => setConfig((c) => ({ ...c, showResponsesMode: v }))}
          label="Imediatamente"
          recommended
        />
        <Radio
          name="showResponses"
          value="on_click"
          current={config.showResponsesMode ?? 'instant'}
          onChange={(v) => setConfig((c) => ({ ...c, showResponsesMode: v }))}
          label="Só quando eu liberar"
        />
        <Radio
          name="showResponses"
          value="private"
          current={config.showResponsesMode ?? 'instant'}
          onChange={(v) => setConfig((c) => ({ ...c, showResponsesMode: v }))}
          label="Privadas (só eu vejo)"
        />
      </Section>
      </div>

      <div className="space-y-3" hidden={tab !== 'design'}>
      <Section title="Design">
        <p className="text-[11px] uppercase font-bold text-ink/55 mb-1">Plano de fundo</p>
        <div className="grid grid-cols-3 gap-1.5">
          {/* "Sem fundo" — útil pra OBS browser source (telão transparente
              continua mostrando palavras sobre o vídeo da câmera). */}
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, background: { type: 'none' } }))}
            className={`h-12 rounded-md border text-[10px] font-medium overflow-hidden relative ${
              bg.type === 'none' ? 'border-accent ring-1 ring-accent/40' : 'border-ink/15 hover:border-accent'
            }`}
            style={{
              backgroundImage:
                'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }}
            title="Sem fundo (transparente, ideal pra OBS)"
          >
            <span
              className="absolute bottom-0 left-0 right-0 bg-paper/80 backdrop-blur px-1 text-ink truncate"
              style={{ lineHeight: '14px' }}
            >
              Sem fundo
            </span>
          </button>
          {BACKGROUND_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setConfig((c) => ({ ...c, background: p.bg, palette: p.palette }))}
              className="h-12 rounded-md border border-ink/15 hover:border-accent text-[10px] font-medium overflow-hidden relative"
              style={{
                ...(p.bg.type === 'color' ? { background: p.bg.value } : {}),
                ...(p.bg.type === 'gradient'
                  ? { background: `linear-gradient(135deg, ${p.bg.from}, ${p.bg.to})` }
                  : {}),
              }}
              title={p.label}
            >
              <span
                className="absolute bottom-0 left-0 right-0 bg-paper/80 backdrop-blur px-1 text-ink truncate"
                style={{ lineHeight: '14px' }}
              >
                {p.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <input
            type="color"
            aria-label="Cor sólida"
            value={bg.type === 'color' ? bg.value : '#FFFFFF'}
            onChange={(e) => setBg({ type: 'color', value: e.target.value })}
            className="h-9 w-9 rounded cursor-pointer"
            title="Cor sólida"
          />
          {bg.type === 'gradient' ? (
            <>
              <input
                type="color"
                value={bg.from}
                onChange={(e) => setBg({ type: 'gradient', from: e.target.value, to: bg.to })}
                className="h-9 w-9 rounded cursor-pointer"
                title="Gradiente cor 1"
              />
              <input
                type="color"
                value={bg.to}
                onChange={(e) => setBg({ type: 'gradient', from: bg.from, to: e.target.value })}
                className="h-9 w-9 rounded cursor-pointer"
                title="Gradiente cor 2"
              />
            </>
          ) : null}
          <BgImageUploader
            eventId={slide.event_id}
            current={bg.type === 'image' ? bg.url : null}
            onUploaded={(url) =>
              setBg({ type: 'image', url, fit: 'cover', opacity: 1, blurPx: 0 })
            }
            onClear={() => setBg({ type: 'color', value: '#FFFFFF' })}
            label={bg.type === 'image' ? 'Trocar imagem' : 'Subir imagem 16:9'}
          />
        </div>

        {bg.type === 'image' ? (
          <div className="mt-2 space-y-2">
            <img
              src={bg.url}
              alt=""
              className="w-full aspect-video object-cover rounded border border-ink/15"
              style={{ opacity: bg.opacity ?? 1 }}
            />
            <label className="block text-[11px] text-ink/55">
              Opacidade {Math.round((bg.opacity ?? 1) * 100)}%
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={bg.opacity ?? 1}
                onChange={(e) => setBg({ ...bg, opacity: Number(e.target.value) })}
                className="w-full"
              />
            </label>
            <label className="block text-[11px] text-ink/55">
              Desfoque {bg.blurPx ?? 0}px
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={bg.blurPx ?? 0}
                onChange={(e) => setBg({ ...bg, blurPx: Number(e.target.value) })}
                className="w-full"
              />
            </label>
          </div>
        ) : null}

        <p className="text-[11px] uppercase font-bold text-ink/55 mt-3 mb-1">Cor do texto</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, textColorOverride: undefined }))}
            className={`h-9 px-2 text-xs rounded border ${
              config.textColorOverride === undefined
                ? 'border-accent bg-accent/10 text-accent font-medium'
                : 'border-ink/15 text-ink/70 hover:bg-ink/5'
            }`}
          >
            Auto
          </button>
          <input
            type="color"
            value={config.textColorOverride ?? '#000000'}
            onChange={(e) => setConfig((c) => ({ ...c, textColorOverride: e.target.value }))}
            className="h-9 w-9 rounded cursor-pointer"
            aria-label="Cor do texto"
          />
        </div>

        <p className="text-[11px] uppercase font-bold text-ink/55 mt-3 mb-1">Paleta da nuvem</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, palette: PALETTE_LIGHT }))}
            className="flex-1 h-9 rounded-md border border-ink/15 hover:border-accent text-xs font-medium flex items-center justify-center gap-0.5"
            title="Vivas (fundo claro)"
          >
            {PALETTE_LIGHT.slice(0, 5).map((c) => (
              <span
                key={c}
                className="h-4 w-2 rounded-sm"
                style={{ background: c }}
                aria-hidden
              />
            ))}
          </button>
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, palette: PALETTE_DARK }))}
            className="flex-1 h-9 rounded-md border border-ink/15 hover:border-accent text-xs font-medium flex items-center justify-center gap-0.5"
            title="Pastéis (fundo escuro)"
          >
            {PALETTE_DARK.slice(0, 5).map((c) => (
              <span
                key={c}
                className="h-4 w-2 rounded-sm"
                style={{ background: c }}
                aria-hidden
              />
            ))}
          </button>
        </div>

        <p className="text-[11px] uppercase font-bold text-ink/55 mt-3 mb-1">Imagem de conteúdo</p>
        <BgImageUploader
          eventId={slide.event_id}
          current={config.contentImageUrl ?? null}
          onUploaded={(url) => setConfig((c) => ({ ...c, contentImageUrl: url }))}
          onClear={() => setConfig((c) => ({ ...c, contentImageUrl: undefined }))}
          label={config.contentImageUrl ? 'Trocar' : '+ Subir imagem'}
        />
        {config.contentImageUrl ? (
          <img
            src={config.contentImageUrl}
            alt=""
            className="mt-2 w-full max-h-32 object-contain rounded border border-ink/15"
          />
        ) : null}
      </Section>
      </div>

      <div className="space-y-3" hidden={tab !== 'avancado'}>
      <Section title="QR code do telão" live>
        <Check
          label="QR code visível enquanto apresenta"
          checked={config.showQr !== false}
          onChange={(v) => setConfig((c) => ({ ...c, showQr: v }))}
        />
        <p className="text-xs text-ink/55 mt-1">
          Card lateral com QR + URL. <LiveBadge /> Afeta o telão na hora.
        </p>
        <div className="flex items-center justify-between gap-3 mt-3">
          <span className="text-sm text-ink">Mostrar como</span>
          <select
            value={config.joinInfoType ?? 'qr_and_url'}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                joinInfoType: e.target.value as WordcloudConfig['joinInfoType'],
              }))
            }
            className="h-9 rounded-md border border-ink/20 bg-paper text-sm px-2"
          >
            <option value="qr_and_url">QR + URL</option>
            <option value="qr">Apenas QR</option>
            <option value="url">Apenas URL</option>
            <option value="code">Apenas código</option>
          </select>
        </div>
      </Section>

      <Section title="No telão" live>
        <Check
          label="Contador de palavras enviadas"
          checked={config.showTotal !== false}
          onChange={(v) => setConfig((c) => ({ ...c, showTotal: v }))}
        />
      </Section>

      <Section title="Filtros">
        <Check
          label="Filtrar palavras comuns"
          checked={config.filterStopwords !== false}
          onChange={(v) => setConfig((c) => ({ ...c, filterStopwords: v }))}
        />
        <Check
          label="Bloquear palavrões"
          checked={config.filterProfanity !== false}
          onChange={(v) => setConfig((c) => ({ ...c, filterProfanity: v }))}
        />
      </Section>

      <Section title="Notas do apresentador">
        <textarea
          value={config.speakerNotes ?? ''}
          onChange={(e) => setConfig((c) => ({ ...c, speakerNotes: e.target.value }))}
          placeholder="Anotações privadas pra você lembrar durante a apresentação. Não aparece no telão nem na audiência."
          rows={3}
          className="w-full rounded-md border border-ink/20 bg-paper text-sm p-2 resize-y"
        />
      </Section>

      <div className="rounded-md border border-ink/10 bg-paper p-3 flex flex-col gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConfig((c) => ({
              ...c,
              background: { type: 'color', value: '#FFFFFF' },
              palette: PALETTE_LIGHT,
              textColorOverride: undefined,
            }));
          }}
          className="justify-start"
        >
          ⚪ Voltar pro tema branco (padrão)
        </Button>
        {onApplyToAll ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm('Aplicar essas configurações a todos os outros slides?')) {
                onApplyToAll();
              }
            }}
            className="justify-start"
          >
            ↕ Aplicar a todos os slides
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (
              window.confirm(
                'Zerar todas as palavras enviadas a este slide? Não afeta outros slides.',
              )
            ) {
              void resetSlideWords(slide.id);
            }
          }}
          className="justify-start text-danger"
        >
          🔄 Resetar resultados deste slide
        </Button>
      </div>
      </div>
    </div>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-wider align-middle ml-1">
      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
      Ao vivo
    </span>
  );
}

export function Section({
  title,
  children,
  live,
}: {
  title: string;
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="rounded-xl bg-paper p-3 shadow-sm">
      <h4 className="text-xs uppercase tracking-wide font-bold text-ink/60 mb-2 flex items-center gap-1.5">
        {title}
        {live ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/10 text-success text-[9px] font-bold uppercase tracking-wider normal-case">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span className="uppercase tracking-wider">Ao vivo</span>
          </span>
        ) : null}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-ink/30"
      />
      <span className="text-ink">{label}</span>
    </label>
  );
}

export function Radio<V extends string>({
  name,
  value,
  current,
  onChange,
  label,
  recommended,
}: {
  name: string;
  value: V;
  current: V;
  onChange: (v: V) => void;
  label: string;
  recommended?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input
        type="radio"
        name={name}
        checked={current === value}
        onChange={() => onChange(value)}
        className="mt-1 h-4 w-4 border-ink/30"
      />
      <span className="text-ink leading-tight">
        {label}
        {recommended ? (
          <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-success">
            recomendado
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function BgImageUploader({
  eventId,
  current,
  onUploaded,
  onClear,
  label,
}: {
  eventId: string;
  current: string | null;
  onUploaded: (url: string) => void;
  onClear: () => void;
  label: string;
}) {
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFile = (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set('file', file);
    startUpload(async () => {
      const r = await uploadEventAsset(eventId, fd);
      if (!r.ok) {
        setError(
          r.error === 'too_large'
            ? 'Imagem muito grande (máx 8 MB)'
            : r.error === 'unsupported_type'
              ? 'Use PNG, JPG, WEBP ou GIF'
              : `Erro: ${r.error}`,
        );
        return;
      }
      onUploaded(r.url);
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button size="sm" variant="accent" loading={uploading} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      {current ? (
        <Button size="sm" variant="ghost" onClick={onClear}>
          Remover
        </Button>
      ) : null}
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </div>
  );
}
