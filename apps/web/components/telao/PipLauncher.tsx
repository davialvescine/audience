'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options: { width: number; height: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

type Props = { children: ReactNode };

export function PipLauncher({ children }: Props) {
  const [supported, setSupported] = useState(false);
  const [inIframe, setInIframe] = useState(true);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'documentPictureInPicture' in window);
    setInIframe(typeof window !== 'undefined' && window.parent !== window);
  }, []);

  // Sync stylesheets into the PiP window so Tailwind classes work there
  useEffect(() => {
    if (!pipWindow) return;
    const main = window.document;
    const pip = pipWindow.document;

    pip.body.style.margin = '0';
    pip.body.style.background = 'transparent';
    pip.documentElement.style.background = 'transparent';
    pip.documentElement.lang = 'pt-BR';

    // Title for the PiP window
    pip.title = 'Audience — Telão';

    // Copy <link rel=stylesheet> tags
    [...main.querySelectorAll('link[rel="stylesheet"]')].forEach((origLink) => {
      const link = pip.createElement('link');
      link.rel = 'stylesheet';
      link.href = (origLink as HTMLLinkElement).href;
      pip.head.appendChild(link);
    });

    // Copy inline <style> tags + style sheets that have rules accessible
    [...main.styleSheets].forEach((sheet) => {
      try {
        const cssText = [...sheet.cssRules].map((r) => r.cssText).join('\n');
        if (!cssText) return;
        const styleEl = pip.createElement('style');
        styleEl.textContent = cssText;
        pip.head.appendChild(styleEl);
      } catch {
        // Cross-origin stylesheet — already linked above via <link>
      }
    });
  }, [pipWindow]);

  const openPip = async () => {
    if (!window.documentPictureInPicture) return;
    setError(null);
    try {
      const win = await window.documentPictureInPicture.requestWindow({
        width: 720,
        height: 280,
      });
      setPipWindow(win);
      win.addEventListener('pagehide', () => {
        setPipWindow(null);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a janela flutuante.');
    }
  };

  // PiP active → portal the telão into the PiP window, show a status message in main tab
  if (pipWindow) {
    return (
      <>
        {createPortal(children, pipWindow.document.body)}
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(10, 18, 35, 0.92)', zIndex: 9999 }}
        >
          <div className="text-center px-6 max-w-md pointer-events-auto">
            <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(16,185,129,0.18)' }}>
              <svg className="h-7 w-7" style={{ color: '#10B981' }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-display font-bold text-white mb-2">
              Telão flutuante ativo
            </h1>
            <p className="text-white/70 text-sm mb-4">
              Os comentários estão aparecendo na janelinha flutuante. Posicione ela onde quiser na tela e inicie sua apresentação.
            </p>
            <p className="text-white/50 text-xs">
              Pode minimizar essa aba — não feche enquanto o evento estiver no ar.
            </p>
            <button
              type="button"
              onClick={() => pipWindow.close()}
              className="mt-5 inline-flex items-center justify-center h-10 px-5 rounded-md text-sm font-medium border border-white/20 text-white hover:bg-white/5"
            >
              Fechar janela flutuante
            </button>
          </div>
        </div>
      </>
    );
  }

  // PiP supported but not active → show launcher UI on top of the (still rendered) telão
  if (supported && !inIframe) {
    return (
      <>
        {children}
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(10, 18, 35, 0.85)', zIndex: 9999 }}
        >
          <div className="text-center px-6 max-w-md pointer-events-auto">
            <div className="mx-auto mb-5 inline-flex items-center justify-center h-16 w-16 rounded-2xl" style={{ background: 'rgba(245,197,24,0.18)' }}>
              <svg className="h-8 w-8" style={{ color: '#F5C518' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="14" rx="2" />
                <rect x="11" y="11" width="9" height="6" rx="1" />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">Janela flutuante</h1>
            <p className="text-white/70 text-sm mb-6">
              Os comentários da audiência vão aparecer numa janela que fica sempre por cima da sua apresentação.
            </p>
            <button
              type="button"
              onClick={openPip}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md font-medium transition"
              style={{ background: '#F5C518', color: '#0A2540' }}
            >
              Abrir janela flutuante
            </button>
            {error ? <p className="mt-4 text-sm text-red-300">⚠ {error}</p> : null}
            <p className="mt-6 text-xs text-white/50">
              Depois de abrir, arraste a janelinha pro canto da tela e inicie sua apresentação normalmente.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Browser doesn't support Document PiP and we're not in iframe — show fallback message
  if (!supported && !inIframe) {
    return (
      <>
        {children}
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(10, 18, 35, 0.95)', zIndex: 9999 }}
        >
          <div className="text-center px-6 max-w-md pointer-events-auto">
            <h1 className="text-xl font-display font-bold text-white mb-3">Navegador não compatível</h1>
            <p className="text-white/70 text-sm mb-3">
              A janela flutuante usa uma API moderna do Chrome (Document Picture-in-Picture).
            </p>
            <p className="text-white/60 text-sm mb-4">
              Use <strong>Chrome</strong>, <strong>Edge</strong> ou <strong>Brave</strong> atualizados (versão 116 ou superior).
            </p>
            <p className="text-white/50 text-xs">
              Alternativa: abra essa URL como Browser Source no OBS Studio.
            </p>
          </div>
        </div>
      </>
    );
  }

  // In iframe (preview) — just render children
  return <>{children}</>;
}
