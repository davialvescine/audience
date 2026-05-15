'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { Slide } from '@/lib/slides/types';
import { uploadEventAsset } from '@/server-actions/uploadEventAsset';

type Props = {
  slide: Slide;
  onChange: (config: WordcloudConfig) => void;
};

const DEBOUNCE_MS = 500;
const PALETTE_LIGHT = [
  '#E63946', '#1D3557', '#2A9D8F', '#E76F51', '#6A4C93', '#0077B6', '#06A77D', '#D62828',
];
const PALETTE_DARK = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8E6CF',
];

export function SlidePropsPanel({ slide, onChange }: Props) {
  const initial = slide.config as WordcloudConfig;
  const [config, setConfig] = useState<WordcloudConfig>(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(true);

  useEffect(() => {
    setConfig(slide.config as WordcloudConfig);
    skipNext.current = true;
  }, [slide.id, slide.config]);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(config), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [config, onChange]);

  const setBg = (bg: WordcloudBackground) => setConfig((c) => ({ ...c, background: bg }));
  const bg = (config.background ?? { type: 'none' }) as WordcloudBackground;

  return (
    <div className="space-y-3 pb-4">
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

      <Section title="Fundo">
        <div className="grid grid-cols-2 gap-1.5">
          <BgBtn label="Branco" active={bg.type === 'color' && bg.value.toUpperCase() === '#FFFFFF'} onClick={() => setConfig((c) => ({ ...c, background: { type: 'color', value: '#FFFFFF' }, palette: PALETTE_LIGHT }))} />
          <BgBtn label="Escuro" active={bg.type === 'color' && bg.value.toUpperCase() === '#0A2540'} onClick={() => setConfig((c) => ({ ...c, background: { type: 'color', value: '#0A2540' }, palette: PALETTE_DARK }))} />
          <BgBtn label="Cor" active={bg.type === 'color' && bg.value.toUpperCase() !== '#FFFFFF' && bg.value.toUpperCase() !== '#0A2540'} onClick={() => setBg({ type: 'color', value: bg.type === 'color' ? bg.value : '#4ECDC4' })} />
          <BgBtn label="Gradiente" active={bg.type === 'gradient'} onClick={() => setBg({ type: 'gradient', from: bg.type === 'gradient' ? bg.from : '#0A2540', to: bg.type === 'gradient' ? bg.to : '#4ECDC4' })} />
          <BgBtn label="Imagem" active={bg.type === 'image'} onClick={() => setBg({ type: 'image', url: bg.type === 'image' ? bg.url : '', fit: 'cover', opacity: 1, blurPx: 0 })} />
          <BgBtn label="Sem fundo" active={bg.type === 'none'} onClick={() => setBg({ type: 'none' })} />
        </div>

        {bg.type === 'color' && bg.value.toUpperCase() !== '#FFFFFF' && bg.value.toUpperCase() !== '#0A2540' ? (
          <input
            type="color"
            value={bg.value}
            onChange={(e) => setBg({ type: 'color', value: e.target.value })}
            className="mt-2 h-9 w-full rounded cursor-pointer"
            aria-label="Cor"
          />
        ) : null}

        {bg.type === 'gradient' ? (
          <div className="mt-2 flex gap-2">
            <input type="color" value={bg.from} onChange={(e) => setBg({ type: 'gradient', from: e.target.value, to: bg.to })} className="h-9 flex-1 rounded cursor-pointer" aria-label="De" />
            <input type="color" value={bg.to} onChange={(e) => setBg({ type: 'gradient', from: bg.from, to: e.target.value })} className="h-9 flex-1 rounded cursor-pointer" aria-label="Pra" />
          </div>
        ) : null}

        {bg.type === 'image' ? <ImageUpload eventId={slide.event_id} bg={bg} setBg={setBg} /> : null}
      </Section>

      <Section title="Filtros">
        <Check
          label="Filtrar palavras comuns"
          checked={config.filterStopwords}
          onChange={(v) => setConfig((c) => ({ ...c, filterStopwords: v }))}
        />
        <Check
          label="Bloquear palavrões"
          checked={config.filterProfanity}
          onChange={(v) => setConfig((c) => ({ ...c, filterProfanity: v }))}
        />
        <Check
          label="Mostrar contador no telão"
          checked={config.showTotal}
          onChange={(v) => setConfig((c) => ({ ...c, showTotal: v }))}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper p-3">
      <h4 className="text-xs uppercase tracking-wide font-bold text-ink/60 mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BgBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-2 text-xs rounded border font-medium ${
        active ? 'border-accent bg-accent/10 text-accent' : 'border-ink/15 text-ink/70 hover:bg-ink/5'
      }`}
    >
      {label}
    </button>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
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

type ImageBg = Extract<WordcloudBackground, { type: 'image' }>;

function ImageUpload({
  eventId,
  bg,
  setBg,
}: {
  eventId: string;
  bg: ImageBg;
  setBg: (b: WordcloudBackground) => void;
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
          r.error === 'too_large' ? 'Imagem muito grande (máx 8 MB)'
          : r.error === 'unsupported_type' ? 'Use PNG, JPG, WEBP ou GIF'
          : 'Não rolou subir.',
        );
        return;
      }
      setBg({ type: 'image', url: r.url, fit: bg.fit ?? 'cover', opacity: bg.opacity ?? 1, blurPx: bg.blurPx ?? 0 });
    });
  };

  return (
    <div className="mt-2 space-y-2">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="flex gap-2">
        <Button size="sm" variant="accent" loading={uploading} onClick={() => inputRef.current?.click()}>
          {bg.url ? 'Trocar' : 'Subir imagem 16:9'}
        </Button>
        {bg.url ? (
          <Button size="sm" variant="ghost" onClick={() => setBg({ type: 'image', url: '', fit: 'cover', opacity: 1, blurPx: 0 })}>
            Remover
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-ink/55">PNG/JPG/WEBP até 8 MB · ideal 1920×1080 (16:9).</p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {bg.url ? (
        <>
          <img src={bg.url} alt="" className="w-full aspect-video object-cover rounded border border-ink/15" style={{ opacity: bg.opacity ?? 1 }} />
          <label className="block text-xs">
            <span className="text-ink/60">Opacidade {Math.round((bg.opacity ?? 1) * 100)}%</span>
            <input type="range" min={0.2} max={1} step={0.05} value={bg.opacity ?? 1} onChange={(e) => setBg({ ...bg, opacity: Number(e.target.value) })} className="w-full" />
          </label>
          <label className="block text-xs">
            <span className="text-ink/60">Desfoque {bg.blurPx ?? 0}px</span>
            <input type="range" min={0} max={20} step={1} value={bg.blurPx ?? 0} onChange={(e) => setBg({ ...bg, blurPx: Number(e.target.value) })} className="w-full" />
          </label>
        </>
      ) : null}
    </div>
  );
}
