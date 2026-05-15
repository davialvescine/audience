'use client';

import { useEffect, useRef, useState } from 'react';

import { WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { Slide } from '@/lib/slides/types';
import type { WordEntry } from '@/lib/wordcloud/types';

type Props = {
  slide: Slide;
  liveConfig?: WordcloudConfig | undefined;
  telaoUrl: string;
};

const SAMPLE_ENTRIES: WordEntry[] = [
  { text: 'amor', count: 8 },
  { text: 'paz', count: 6 },
  { text: 'esperança', count: 4 },
  { text: 'alegria', count: 4 },
  { text: 'fé', count: 3 },
  { text: 'gratidão', count: 3 },
  { text: 'união', count: 2 },
  { text: 'luz', count: 2 },
];

export function SlideCanvas({ slide, liveConfig }: Props) {
  return (
    <div className="h-full w-full grid grid-cols-[1fr_300px] gap-3 p-3">
      {/* Telão (presenter screen) */}
      <div className="flex flex-col gap-2 min-w-0">
        <div className="text-xs uppercase tracking-wide font-bold text-ink/55 text-center">
          Tela do telão (projetor / tela cheia)
        </div>
        <TelaoFrame slide={slide} liveConfig={liveConfig} />
      </div>

      {/* Celular (participant screen) */}
      <div className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wide font-bold text-ink/55 text-center">
          Tela do participante (celular)
        </div>
        <PhoneFrame slide={slide} liveConfig={liveConfig} />
      </div>
    </div>
  );
}

function TelaoFrame({ slide, liveConfig }: { slide: Slide; liveConfig?: WordcloudConfig }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const sx = el.clientWidth / 1920;
      const sy = el.clientHeight / 1080;
      setScale(Math.max(0.1, Math.min(sx, sy)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative flex-1 flex items-center justify-center min-h-0">
      <div
        className="relative shadow-2xl rounded-lg overflow-hidden"
        style={{ width: 1920 * scale, height: 1080 * scale }}
      >
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {slide.type === 'wordcloud' ? (
            <WordCloudDisplay
              eventId={slide.event_id}
              config={liveConfig ?? (slide.config as WordcloudConfig)}
              initialEntries={SAMPLE_ENTRIES}
              channel={makeNoopChannel()}
              showBackground
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/5">
              <p className="text-3xl text-ink/40">Tipo {slide.type} ainda sem preview.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ slide, liveConfig }: { slide: Slide; liveConfig?: WordcloudConfig }) {
  const cfg = (liveConfig ?? slide.config) as WordcloudConfig;
  const maxWords = cfg.maxWordsPerSubmission ?? 1;
  const inputs = Array.from({ length: maxWords });

  return (
    <div className="relative flex-1 min-h-0 flex items-center justify-center">
      {/* Phone outline */}
      <div className="relative bg-ink/90 rounded-[40px] p-3 shadow-2xl" style={{ width: 240, height: 480 }}>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-16 rounded-full bg-ink/70" />
        <div className="bg-gradient-to-br from-primary via-primary-deep to-primary rounded-[28px] overflow-hidden h-full p-4 flex flex-col text-paper">
          <div className="text-center mb-3">
            <div className="inline-block px-2 py-0.5 rounded-full bg-paper/10 text-[8px] uppercase tracking-wider mb-2">
              Ao vivo no telão
            </div>
            <h2 className="font-display font-bold text-sm leading-tight">Evento</h2>
            <p className="text-[10px] opacity-80 mt-0.5">Sua palavra na nuvem</p>
          </div>

          <div className="bg-paper text-ink rounded-xl p-3 flex-1">
            <p className="text-[11px] mb-2 leading-tight">{cfg.question || '(sem pergunta)'}</p>
            {inputs.map((_, i) => (
              <div
                key={i}
                className="mb-1.5 h-7 rounded-md border border-ink/20 px-2 text-[10px] flex items-center text-ink/40"
              >
                Digite uma palavra…
              </div>
            ))}
            <button
              type="button"
              disabled
              className="w-full h-8 rounded-md bg-accent text-ink text-[11px] font-medium mt-1"
            >
              Enviar palavra
            </button>
          </div>

          <p className="text-center text-[8px] opacity-60 mt-2">
            ✨ Sua palavra entra na nuvem em tempo real
          </p>
        </div>
      </div>
    </div>
  );
}

type ChannelLike = Parameters<typeof WordCloudDisplay>[0]['channel'];

function makeNoopChannel(): ChannelLike {
  const self: ChannelLike = {
    on() {
      return self;
    },
    subscribe() {
      return self;
    },
    unsubscribe() {},
  };
  return self;
}
