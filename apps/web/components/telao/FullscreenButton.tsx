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

  // Some quando já está em fullscreen — apresentação limpa, sem
  // overlays de UI. Esc do teclado é o caminho pra sair.
  if (isFullscreen) return null;

  const enter = () => {
    void document.documentElement.requestFullscreen();
  };

  return (
    <button
      type="button"
      onClick={enter}
      aria-label="Entrar em tela cheia"
      title="Entrar em tela cheia"
      className="fixed bottom-24 right-8 z-[100] h-12 w-12 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center shadow-lg transition"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
      </svg>
    </button>
  );
}
