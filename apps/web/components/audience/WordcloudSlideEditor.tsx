'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { Slide } from '@/lib/slides/types';
import { uploadEventAsset } from '@/server-actions/uploadEventAsset';

type Props = {
  slide: Slide;
  slug: string;
  telaoUrl: string;
  onChange: (config: WordcloudConfig) => void;
};

const DEBOUNCE_MS = 600;
const DEFAULT_BG_COLOR = '#0A2540';
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

export function WordcloudSlideEditor({ slide, telaoUrl, onChange }: Props) {
  const initial = slide.config as WordcloudConfig;
  const [config, setConfig] = useState<WordcloudConfig>(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true);

  // Reset state when switching to a different slide.
  useEffect(() => {
    setConfig(slide.config as WordcloudConfig);
    skipNextSaveRef.current = true;
  }, [slide.id, slide.config]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(config), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [config, onChange]);

  const setBackground = (bg: WordcloudBackground) =>
    setConfig((c) => ({ ...c, background: bg }));
  const bg: WordcloudBackground = config.background ?? { type: 'none' };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Pergunta</h3>
        <Input
          label="O que vai aparecer no celular e no topo do telão"
          id={`wc-question-${slide.id}`}
          value={config.question}
          onChange={(e) => setConfig((c) => ({ ...c, question: e.target.value }))}
          maxLength={120}
          placeholder="Em uma palavra, o que você espera deste evento?"
        />
      </Card>

      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Aparência</h3>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-ink mb-2">Plano de fundo do telão</p>
            <div className="flex flex-wrap items-center gap-2">
              <BgChip label="Transparente" active={bg.type === 'none'} onClick={() => setBackground({ type: 'none' })} />
              <BgChip
                label="Branco (Menti)"
                active={bg.type === 'color' && bg.value.toUpperCase() === '#FFFFFF'}
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    background: { type: 'color', value: '#FFFFFF' },
                    palette: PALETTE_LIGHT,
                  }))
                }
              />
              <BgChip
                label="Cor sólida"
                active={bg.type === 'color' && bg.value.toUpperCase() !== '#FFFFFF'}
                onClick={() =>
                  setBackground({
                    type: 'color',
                    value: bg.type === 'color' ? bg.value : DEFAULT_BG_COLOR,
                  })
                }
              />
              <BgChip
                label="Gradiente"
                active={bg.type === 'gradient'}
                onClick={() =>
                  setBackground({
                    type: 'gradient',
                    from: bg.type === 'gradient' ? bg.from : '#0A2540',
                    to: bg.type === 'gradient' ? bg.to : '#4ECDC4',
                  })
                }
              />
              <BgChip
                label="Imagem"
                active={bg.type === 'image'}
                onClick={() =>
                  setBackground({
                    type: 'image',
                    url: bg.type === 'image' ? bg.url : '',
                    fit: bg.type === 'image' ? (bg.fit ?? 'cover') : 'cover',
                    opacity: bg.type === 'image' ? (bg.opacity ?? 1) : 1,
                    blurPx: bg.type === 'image' ? (bg.blurPx ?? 0) : 0,
                  })
                }
              />
            </div>

            {bg.type === 'color' ? (
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Cor de fundo"
                  value={bg.value}
                  onChange={(e) => setBackground({ type: 'color', value: e.target.value })}
                  className="h-10 w-16 rounded cursor-pointer"
                />
                <span className="font-mono text-sm text-ink/70">{bg.value}</span>
              </div>
            ) : null}

            {bg.type === 'gradient' ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  aria-label="Cor 1"
                  value={bg.from}
                  onChange={(e) =>
                    setBackground({ type: 'gradient', from: e.target.value, to: bg.to })
                  }
                  className="h-10 w-16 rounded cursor-pointer"
                />
                <input
                  type="color"
                  aria-label="Cor 2"
                  value={bg.to}
                  onChange={(e) =>
                    setBackground({ type: 'gradient', from: bg.from, to: e.target.value })
                  }
                  className="h-10 w-16 rounded cursor-pointer"
                />
                <div
                  className="h-10 w-32 rounded border border-ink/20"
                  style={{ background: `linear-gradient(135deg, ${bg.from}, ${bg.to})` }}
                  aria-hidden="true"
                />
              </div>
            ) : null}

            {bg.type === 'image' ? (
              <ImageEditor
                eventId={slide.event_id}
                bg={bg}
                setBackground={setBackground}
              />
            ) : null}
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.showTotal}
              onChange={(e) => setConfig((c) => ({ ...c, showTotal: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">Mostrar contador de palavras enviadas no telão</span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-ink">Preview ao vivo</p>
              <a
                href={`${telaoUrl}?mode=fullscreen`}
                target="_blank"
                rel="noopener"
                className="text-xs text-primary hover:underline"
              >
                Abrir em nova aba ↗
              </a>
            </div>
            <div
              className="relative w-full overflow-hidden rounded-lg border border-ink/15"
              style={{ aspectRatio: '16 / 9' }}
            >
              <iframe
                title="Preview do slide"
                src={`${telaoUrl}?mode=fullscreen`}
                className="absolute inset-0 w-full h-full"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Filtros e limites</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.filterStopwords}
              onChange={(e) => setConfig((c) => ({ ...c, filterStopwords: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">Filtrar palavras comuns (de, que, para…)</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.filterProfanity}
              onChange={(e) => setConfig((c) => ({ ...c, filterProfanity: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">Bloquear palavrões</span>
          </label>
        </div>
      </Card>
    </div>
  );
}

function BgChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-md border text-sm font-medium transition ${
        active
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-ink/20 text-ink/70 hover:bg-ink/5'
      }`}
    >
      {label}
    </button>
  );
}

type ImageBg = Extract<WordcloudBackground, { type: 'image' }>;

function ImageEditor({
  eventId,
  bg,
  setBackground,
}: {
  eventId: string;
  bg: ImageBg;
  setBackground: (b: WordcloudBackground) => void;
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
              : 'Não rolou subir. Tenta de novo.',
        );
        return;
      }
      setBackground({
        type: 'image',
        url: r.url,
        fit: bg.fit ?? 'cover',
        opacity: bg.opacity ?? 1,
        blurPx: bg.blurPx ?? 0,
      });
    });
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button type="button" size="sm" variant="accent" loading={uploading} onClick={() => inputRef.current?.click()}>
          {bg.url ? 'Trocar imagem' : 'Subir imagem'}
        </Button>
        {bg.url ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setBackground({ type: 'image', url: '', fit: bg.fit ?? 'cover', opacity: bg.opacity ?? 1, blurPx: bg.blurPx ?? 0 })}
          >
            Remover
          </Button>
        ) : null}
        <span className="text-xs text-ink/60">PNG/JPG/WEBP/GIF até 8 MB. Ideal 1920×1080.</span>
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {bg.url ? (
        <>
          <img src={bg.url} alt="Preview do fundo" className="w-full h-32 object-cover rounded-md border border-ink/15" style={{ opacity: bg.opacity ?? 1 }} />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-ink/60">Encaixe</span>
              <select
                value={bg.fit ?? 'cover'}
                onChange={(e) => setBackground({ ...bg, fit: e.target.value as 'cover' | 'contain' })}
                className="h-9 rounded-md border border-ink/20 bg-paper text-ink px-2 text-sm"
              >
                <option value="cover">Preencher (cover)</option>
                <option value="contain">Caber inteira (contain)</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-ink/60">Opacidade</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={bg.opacity ?? 1}
                onChange={(e) => setBackground({ ...bg, opacity: Number(e.target.value) })}
              />
              <span className="text-xs text-ink/60 w-10 text-right">{Math.round((bg.opacity ?? 1) * 100)}%</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-ink/60">Desfoque</span>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={bg.blurPx ?? 0}
                onChange={(e) => setBackground({ ...bg, blurPx: Number(e.target.value) })}
              />
              <span className="text-xs text-ink/60 w-10 text-right">{bg.blurPx ?? 0}px</span>
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}
