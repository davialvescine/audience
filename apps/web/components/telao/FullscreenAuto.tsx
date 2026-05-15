'use client';

import { useEffect, useState } from 'react';

/**
 * Quando carregado com ?fullscreen=1 na URL, tenta entrar em fullscreen
 * automaticamente. Como Fullscreen API exige gesto do usuário em muitos
 * navegadores, mostra um overlay clicável de "Entrar em tela cheia" caso
 * a tentativa silenciosa falhe.
 */
export function FullscreenAuto() {
  const [needsClick, setNeedsClick] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('fullscreen') !== '1') return;
    // Try silently — works in popup windows opened with window.open
    const el = document.documentElement;
    const tryFs = el.requestFullscreen?.();
    if (tryFs && typeof tryFs.then === 'function') {
      tryFs
        .then(() => setActive(true))
        .catch(() => setNeedsClick(true));
    } else {
      setNeedsClick(true);
    }
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (active || !needsClick) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await document.documentElement.requestFullscreen();
          setNeedsClick(false);
        } catch {
          // user cancelled
        }
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 text-white text-2xl backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 px-6 py-8 rounded-2xl bg-white/10 border border-white/20">
        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
          />
        </svg>
        <span>Clique pra entrar em tela cheia</span>
        <span className="text-sm opacity-70">(ou aperte F11)</span>
      </div>
    </button>
  );
}
