'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const STAGE_W = 1920;
const STAGE_H = 1080;

// Renders children inside a fixed 1920x1080 reference frame that scales
// (preserving aspect ratio) to fit the viewport. Because the frame uses
// `transform`, descendants with `position: fixed` are contained by the
// frame instead of the viewport — so the telão's positioning math stays
// in 1920x1080 space regardless of the actual window size.
export function TelaoStage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setScale(Math.min(w / STAGE_W, h / STAGE_H));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        ref={ref}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
