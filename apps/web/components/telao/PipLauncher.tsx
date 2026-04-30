'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = { children: ReactNode };

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options: { width: number; height: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

export function PipLauncher({ children }: Props) {
  const [supported, setSupported] = useState(false);
  const [inIframe, setInIframe] = useState(true);
  const [pipActive, setPipActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pipWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'documentPictureInPicture' in window);
    setInIframe(typeof window !== 'undefined' && window.parent !== window);
  }, []);

  const openPip = async () => {
    if (!containerRef.current || !window.documentPictureInPicture) return;
    setError(null);
    try {
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 720,
        height: 280,
      });
      pipWindowRef.current = pipWindow;

      // Clone stylesheets so Tailwind/inline styles work inside the PiP window
      [...document.styleSheets].forEach((sheet) => {
        try {
          const cssRules = [...sheet.cssRules].map((r) => r.cssText).join('\n');
          const styleEl = pipWindow.document.createElement('style');
          styleEl.textContent = cssRules;
          pipWindow.document.head.appendChild(styleEl);
        } catch {
          // Cross-origin stylesheet: link via <link> instead
          if (sheet.href) {
            const link = pipWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pipWindow.document.head.appendChild(link);
          }
        }
      });

      // Apply transparent body so the overlay sits on top of nothing
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.background = 'transparent';
      pipWindow.document.documentElement.style.background = 'transparent';

      // Move the actual content
      pipWindow.document.body.appendChild(containerRef.current);
      setPipActive(true);

      pipWindow.addEventListener('pagehide', () => {
        // Move content back to the main document so it survives PiP close
        if (containerRef.current && document.body) {
          document.body.appendChild(containerRef.current);
        }
        pipWindowRef.current = null;
        setPipActive(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a janela flutuante.');
    }
  };

  const showLauncher = supported && !inIframe && !pipActive;

  return (
    <>
      {/* Container holding the actual telão — gets moved into PiP window */}
      <div ref={containerRef}>{children}</div>

      {/* Visible only when we can launch PiP (Chrome/Edge, not in iframe, not active) */}
      {showLauncher ? (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(10, 18, 35, 0.85)', zIndex: 9999 }}
        >
          <div className="text-center px-6 max-w-md pointer-events-auto">
            <div
              className="mx-auto mb-5 inline-flex items-center justify-center h-16 w-16 rounded-2xl"
              style={{ background: 'rgba(245,197,24,0.18)' }}
            >
              <svg className="h-8 w-8" style={{ color: '#F5C518' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="14" rx="2" />
                <rect x="11" y="11" width="9" height="6" rx="1" />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">
              Janela flutuante
            </h1>
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
            {error ? (
              <p className="mt-4 text-sm text-red-300">⚠ {error}</p>
            ) : null}
            <p className="mt-6 text-xs text-white/50">
              Depois de abrir, arraste a janelinha pro canto da tela. Inicie sua apresentação normalmente.
            </p>
          </div>
        </div>
      ) : null}

      {/* If PiP not supported and we're not in iframe (direct browser visit), show a simple message */}
      {!supported && !inIframe ? (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(10, 18, 35, 0.95)', zIndex: 9999 }}
        >
          <div className="text-center px-6 max-w-md pointer-events-auto">
            <h1 className="text-xl font-display font-bold text-white mb-3">
              Navegador não compatível
            </h1>
            <p className="text-white/70 text-sm mb-4">
              A janela flutuante usa uma API moderna do Chrome (Document Picture-in-Picture).
              Use Chrome, Edge ou Brave atualizados.
            </p>
            <p className="text-white/50 text-xs">
              Alternativa: abra essa URL como Browser Source no OBS Studio.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
