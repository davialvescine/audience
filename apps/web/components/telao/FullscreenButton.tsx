'use client';

import { useEffect, useState } from 'react';

/**
 * Botão flutuante de tela cheia. Aparece no canto inferior centro pra
 * operador clicar e entrar em fullscreen quando a auto-detecção falhou
 * (mobile Safari, popup sem gesto). Esconde fora do modo operator.
 *
 * Estado interno só pra ícone — fonte de verdade é document.fullscreenElement.
 */
export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    update();
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
      title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Entrar em tela cheia'}
      className="fixed bottom-6 right-6 z-[100] h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center shadow-lg transition"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isFullscreen ? (
          <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
        ) : (
          <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
        )}
      </svg>
    </button>
  );
}
