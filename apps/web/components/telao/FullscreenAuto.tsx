'use client';

import { useEffect } from 'react';

/**
 * Quando carregado com ?fullscreen=1 na URL, tenta entrar em fullscreen
 * silenciosamente (funciona em popup windows abertas via window.open).
 *
 * Se a tentativa silenciosa falhar (mobile Safari, contexto sem gesto),
 * NÃO mostra overlay — o botão de fullscreen já está na OperatorToolbar
 * do telão (canto inferior), então não tem motivo pra cobrir o slide
 * com uma tela de instrução.
 */
export function FullscreenAuto() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('fullscreen') !== '1') return;
    const el = document.documentElement;
    const tryFs = el.requestFullscreen?.();
    if (tryFs && typeof tryFs.then === 'function') {
      // Silenciosamente ignora falha — usuário usa o botão da toolbar.
      tryFs.catch(() => undefined);
    }
  }, []);

  return null;
}
