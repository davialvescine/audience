import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

// Font geométrica/arredondada estilo Mentimeter. Carregada como CSS
// variable pra ser referenciada nos componentes de wordcloud.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-wordcloud',
  display: 'swap',
});

export const metadata = {
  title: 'Audience',
  description: 'Comentários da audiência ao vivo no telão',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={jakarta.variable}>
      <head>
        {/* Plain <script src> is a resource declaration in React 19 — hoisted and not treated as a renderable child. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
