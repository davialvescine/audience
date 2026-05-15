'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { ShareCard } from '@/components/audience/ShareCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTauri } from '@/hooks/useTauri';
import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import { uploadEventAsset } from '@/server-actions/uploadEventAsset';
import {
  resetWordcloud,
  setWordcloudActive,
  updateWordcloudConfig,
} from '@/server-actions/wordcloud';

type Props = {
  eventId: string;
  initialActive: boolean;
  initialConfig: WordcloudConfig;
  publicUrl: string;
  telaoUrl: string;
  slug: string;
};

const SAVE_DEBOUNCE_MS = 600;
const DEFAULT_BG_COLOR = '#0A2540';

export function WordcloudTab({
  eventId,
  initialActive,
  initialConfig,
  publicUrl,
  telaoUrl,
  slug,
}: Props) {
  const { isTauri, invoke } = useTauri();
  const [active, setActive] = useState(initialActive);
  const [config, setConfig] = useState<WordcloudConfig>(initialConfig);
  const [toggling, startToggle] = useTransition();
  const [resetting, startReset] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void updateWordcloudConfig(eventId, config);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [eventId, config]);

  const toggle = () => {
    startToggle(async () => {
      const next = !active;
      setActive(next);
      const r = await setWordcloudActive(eventId, next);
      if (!r.ok) setActive(!next);
    });
  };

  const onReset = () => {
    if (!window.confirm('Limpar todas as palavras enviadas? Não dá pra desfazer.')) return;
    startReset(async () => {
      await resetWordcloud(eventId);
    });
  };

  const setMax = (n: 1 | 2 | 3) => setConfig((c) => ({ ...c, maxWordsPerSubmission: n }));

  const setBackground = (bg: WordcloudBackground) => setConfig((c) => ({ ...c, background: bg }));

  const bg: WordcloudBackground = config.background ?? { type: 'none' };

  return (
    <div className="space-y-4">
      {/* 1. Toggle + status banner */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-display text-lg text-ink">Nuvem de palavras</h3>
            <p className="text-sm text-ink/60">
              Quando ativa, a audiência envia 1 palavra em vez de comentários. O telão troca pra
              exibição da nuvem em tempo real.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Ativar nuvem"
            onClick={toggle}
            disabled={toggling}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              active ? 'bg-accent' : 'bg-ink/20'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-paper transition-transform ${
                active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {active ? (
          <div className="mt-3 rounded-md bg-accent/10 border border-accent/30 px-3 py-2 text-sm text-accent">
            ✨ Nuvem ativa — comentários e disparos H2R ficam em pausa.
          </div>
        ) : null}
      </Card>

      {/* 2. Links — público + 2 modos de telão (browser source vs tela cheia) */}
      <ShareCard publicUrl={publicUrl} />

      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Links do telão da nuvem</h3>
        <p className="text-sm text-ink/60 mb-4">
          Use o link de <strong>OBS/Browser Source</strong> pra sobrepor a nuvem em outra fonte
          de vídeo (fundo transparente). Use o link de <strong>Tela cheia</strong> pra projetor
          físico, TV ou aba de navegador (fundo configurável abaixo).
        </p>

        <TelaoLinkRow
          label="OBS / Browser Source (transparente)"
          hint="Sobrepõe a nuvem no OBS, vMix, Streamlabs sem fundo."
          url={`${telaoUrl}?mode=browser_source`}
          onOpen={
            isTauri && invoke
              ? () => {
                  void invoke('open_telao_window', { slug, mode: 'browser_source' });
                }
              : undefined
          }
        />
        <div className="h-3" />
        <TelaoLinkRow
          label="Tela cheia (com fundo)"
          hint="Abre direto no navegador / projetor. Usa o fundo configurado abaixo."
          url={`${telaoUrl}?mode=fullscreen`}
          onOpen={
            isTauri && invoke
              ? () => {
                  void invoke('open_telao_window', { slug, mode: 'fullscreen' });
                }
              : undefined
          }
        />
      </Card>

      {/* 3. Pergunta */}
      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Pergunta</h3>
        <Input
          label="O que vai aparecer no celular e no topo do telão"
          id="wc-question"
          value={config.question}
          onChange={(e) => setConfig((c) => ({ ...c, question: e.target.value }))}
          maxLength={120}
          placeholder="Em uma palavra, o que você espera deste evento?"
        />
      </Card>

      {/* 4. Aparência: paleta + fundo */}
      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Aparência</h3>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-ink mb-2">Plano de fundo do telão</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setBackground({ type: 'none' })}
                className={`h-10 px-3 rounded-md border text-sm font-medium ${
                  bg.type === 'none'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink/20 text-ink/70 hover:bg-ink/5'
                }`}
              >
                Transparente
              </button>
              <button
                type="button"
                onClick={() =>
                  setBackground({
                    type: 'color',
                    value: bg.type === 'color' ? bg.value : DEFAULT_BG_COLOR,
                  })
                }
                className={`h-10 px-3 rounded-md border text-sm font-medium ${
                  bg.type === 'color'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink/20 text-ink/70 hover:bg-ink/5'
                }`}
              >
                Cor sólida
              </button>
              <button
                type="button"
                onClick={() =>
                  setBackground({
                    type: 'gradient',
                    from: bg.type === 'gradient' ? bg.from : '#0A2540',
                    to: bg.type === 'gradient' ? bg.to : '#4ECDC4',
                  })
                }
                className={`h-10 px-3 rounded-md border text-sm font-medium ${
                  bg.type === 'gradient'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink/20 text-ink/70 hover:bg-ink/5'
                }`}
              >
                Gradiente
              </button>
              <button
                type="button"
                onClick={() =>
                  setBackground({
                    type: 'image',
                    url: bg.type === 'image' ? bg.url : '',
                    fit: bg.type === 'image' ? (bg.fit ?? 'cover') : 'cover',
                    opacity: bg.type === 'image' ? (bg.opacity ?? 1) : 1,
                    blurPx: bg.type === 'image' ? (bg.blurPx ?? 0) : 0,
                  })
                }
                className={`h-10 px-3 rounded-md border text-sm font-medium ${
                  bg.type === 'image'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink/20 text-ink/70 hover:bg-ink/5'
                }`}
              >
                Imagem
              </button>
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
                <label className="flex items-center gap-2">
                  <span className="text-xs text-ink/60">De</span>
                  <input
                    type="color"
                    aria-label="Cor inicial do gradiente"
                    value={bg.from}
                    onChange={(e) =>
                      setBackground({ type: 'gradient', from: e.target.value, to: bg.to })
                    }
                    className="h-10 w-16 rounded cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-ink/60">Pra</span>
                  <input
                    type="color"
                    aria-label="Cor final do gradiente"
                    value={bg.to}
                    onChange={(e) =>
                      setBackground({ type: 'gradient', from: bg.from, to: e.target.value })
                    }
                    className="h-10 w-16 rounded cursor-pointer"
                  />
                </label>
                <div
                  className="h-10 w-32 rounded border border-ink/20"
                  style={{ background: `linear-gradient(135deg, ${bg.from}, ${bg.to})` }}
                  aria-hidden="true"
                />
              </div>
            ) : null}

            {bg.type === 'image' ? (
              <BackgroundImageEditor
                eventId={eventId}
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
        </div>
      </Card>

      {/* 5. Filtros + limites */}
      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Filtros e limites</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-ink mb-2">Palavras por envio</p>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMax(n as 1 | 2 | 3)}
                  className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
                    config.maxWordsPerSubmission === n
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-ink/20 text-ink/70 hover:bg-ink/5'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink/50 mt-1">
              Quantas palavras a galera pode mandar de uma vez (1 = só uma).
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.filterStopwords}
              onChange={(e) => setConfig((c) => ({ ...c, filterStopwords: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">
              Filtrar palavras comuns (de, que, para, ...) silenciosamente
            </span>
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.filterProfanity}
              onChange={(e) => setConfig((c) => ({ ...c, filterProfanity: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">Bloquear palavrões (recomendado)</span>
          </label>
        </div>
      </Card>

      {/* 6. Preview embutido — usa o modo tela cheia pra ver o fundo */}
      {active ? (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-ink">Preview ao vivo</h3>
            <a
              href={`${telaoUrl}?mode=fullscreen`}
              target="_blank"
              rel="noopener"
              className="text-sm text-primary hover:underline"
            >
              Abrir em nova aba ↗
            </a>
          </div>
          <p className="text-xs text-ink/60 mb-3">
            Como a galera vai ver no telão tela cheia. Atualiza em tempo real conforme você
            edita a pergunta e o fundo aqui em cima.
          </p>
          <div
            className="relative w-full overflow-hidden rounded-lg border border-ink/15"
            style={{ aspectRatio: '16 / 9' }}
          >
            <iframe
              title="Preview da nuvem"
              src={`${telaoUrl}?mode=fullscreen`}
              className="absolute inset-0 w-full h-full"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </Card>
      ) : null}

      {/* 7. Zerar */}
      <Card>
        <h3 className="font-display text-lg text-ink mb-2">Zerar nuvem</h3>
        <p className="text-sm text-ink/60 mb-3">
          Apaga todas as palavras enviadas até agora. Útil entre apresentações.
        </p>
        <Button variant="ghost" onClick={onReset} loading={resetting}>
          Limpar nuvem
        </Button>
      </Card>
    </div>
  );
}

type ImageBackground = Extract<WordcloudBackground, { type: 'image' }>;

function BackgroundImageEditor({
  eventId,
  bg,
  setBackground,
}: {
  eventId: string;
  bg: ImageBackground;
  setBackground: (b: WordcloudBackground) => void;
}) {
  const [uploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    setUploadError(null);
    const formData = new FormData();
    formData.set('file', file);
    startUpload(async () => {
      const r = await uploadEventAsset(eventId, formData);
      if (!r.ok) {
        setUploadError(
          r.error === 'too_large'
            ? 'Imagem muito grande (máx 8 MB).'
            : r.error === 'unsupported_type'
              ? 'Use PNG, JPG, WEBP ou GIF.'
              : r.error === 'forbidden'
                ? 'Sem permissão pra subir aqui.'
                : 'Não rolou subir a imagem. Tente de novo.',
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
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          variant="accent"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {bg.url ? 'Trocar imagem' : 'Subir imagem'}
        </Button>
        {bg.url ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              setBackground({
                type: 'image',
                url: '',
                fit: bg.fit ?? 'cover',
                opacity: bg.opacity ?? 1,
                blurPx: bg.blurPx ?? 0,
              })
            }
          >
            Remover imagem
          </Button>
        ) : null}
        <p className="text-xs text-ink/60">
          PNG, JPG, WEBP ou GIF — até 8 MB. Ideal 1920×1080.
        </p>
      </div>

      {uploadError ? (
        <p role="alert" className="text-sm text-danger">
          {uploadError}
        </p>
      ) : null}

      {bg.url ? (
        <>
          <div className="relative overflow-hidden rounded-md border border-ink/15">
            <img
              src={bg.url}
              alt="Preview do fundo"
              className="w-full h-32 object-cover"
              style={{ opacity: bg.opacity ?? 1 }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-ink/60">Encaixe</span>
              <select
                value={bg.fit ?? 'cover'}
                onChange={(e) =>
                  setBackground({
                    ...bg,
                    fit: (e.target.value as 'cover' | 'contain'),
                  })
                }
                className="h-9 rounded-md border border-ink/20 bg-paper text-ink px-2 text-sm"
              >
                <option value="cover">Preencher (cover)</option>
                <option value="contain">Caber inteira (contain)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-ink/60">Opacidade</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={bg.opacity ?? 1}
                onChange={(e) =>
                  setBackground({ ...bg, opacity: Number(e.target.value) })
                }
              />
              <span className="text-xs text-ink/60 w-10 text-right">
                {Math.round((bg.opacity ?? 1) * 100)}%
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-ink/60">Desfoque</span>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={bg.blurPx ?? 0}
                onChange={(e) =>
                  setBackground({ ...bg, blurPx: Number(e.target.value) })
                }
              />
              <span className="text-xs text-ink/60 w-10 text-right">
                {bg.blurPx ?? 0}px
              </span>
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TelaoLinkRow({
  label,
  hint,
  url,
  onOpen,
}: {
  label: string;
  hint: string;
  url: string;
  onOpen?: (() => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wide font-bold text-primary mb-1">{label}</p>
        <p className="font-mono text-sm text-ink break-all">{url}</p>
        <p className="text-xs text-ink/60 mt-1">{hint}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="accent"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </Button>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center justify-center h-9 px-3 text-sm rounded-sm font-medium bg-primary text-paper hover:bg-primary-deep"
          >
            Abrir janela
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center h-9 px-3 text-sm rounded-sm font-medium bg-primary text-paper hover:bg-primary-deep"
          >
            Abrir ↗
          </a>
        )}
      </div>
    </div>
  );
}
