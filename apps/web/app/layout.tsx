import type { ReactNode } from 'react';

import './globals.css';

export const metadata = {
  title: 'Audience',
  description: 'Comentários da audiência ao vivo no telão',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Plain <script src> is a resource declaration in React 19 — hoisted and not treated as a renderable child. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
