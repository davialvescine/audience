'use client';

import { useEffect, useRef, useState } from 'react';

import type { Slide } from '@/lib/slides/types';

type Props = {
  slide: Slide;
  telaoUrl: string;
};

/**
 * Mostra o slide selecionado num canvas 16:9 escalado pra caber no container,
 * usando o próprio /telao em iframe modo fullscreen.
 */
export function SlideCanvas({ slide, telaoUrl }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      // Slide é 1920x1080; escala pelo menor entre largura disponível / 1920 e altura / 1080.
      const sx = el.clientWidth / 1920;
      const sy = el.clientHeight / 1080;
      setScale(Math.min(sx, sy));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative h-full w-full flex items-center justify-center p-4">
      <div
        className="relative shadow-2xl"
        style={{
          width: 1920 * scale,
          height: 1080 * scale,
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe
            key={slide.id + slide.updated_at}
            title={`Slide ${slide.id}`}
            src={`${telaoUrl}?mode=fullscreen&preview=1`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
