'use client';

import { useEffect, useRef, useState } from 'react';

import { WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { Slide } from '@/lib/slides/types';
import type { WordEntry } from '@/lib/wordcloud/types';

type Props = {
  slide: Slide;
  liveConfig?: WordcloudConfig | undefined;
  /** URL pra audiência — passa pro WordCloudDisplay quando QR está habilitado. */
  joinUrl?: string | undefined;
};

// Sample inspirational pt-BR — exibido no preview enquanto a audiência
// ainda não enviou nada. Tamanhos variados pra mostrar o efeito da nuvem.
const SAMPLE_ENTRIES: WordEntry[] = [
  { text: 'criativo', count: 9 },
  { text: 'líder', count: 7 },
  { text: 'foco', count: 6 },
  { text: 'rápido', count: 5 },
  { text: 'ousado', count: 5 },
  { text: 'inspiração', count: 4 },
  { text: 'energia', count: 3 },
  { text: 'paixão', count: 3 },
  { text: 'transformação', count: 2 },
];

/**
 * Canvas central estilo Mentimeter: 1 slide grande (sem celular embutido).
 * O celular do participante é mostrado num popover separado se o operador
 * quiser ver.
 */
export function SlideCanvas({ slide, liveConfig, joinUrl }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const sx = el.clientWidth / 1920;
      const sy = el.clientHeight / 1080;
      setScale(Math.max(0.05, Math.min(sx, sy)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative h-full w-full flex items-center justify-center p-6">
      <div
        className="relative shadow-2xl rounded-xl overflow-hidden"
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
              joinUrl={joinUrl}
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
