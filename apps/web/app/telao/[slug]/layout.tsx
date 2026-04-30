import type { ReactNode } from 'react';

// This layout deliberately does NOT include the global <ThemeToggle> and forces a transparent background
// so the page can be used as a Browser Source in OBS/vMix/Streamlabs.

export default function TelaoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          margin: 0;
          padding: 0;
          overflow: hidden;
          height: 100vh;
        }
      `}</style>
      {children}
    </>
  );
}
