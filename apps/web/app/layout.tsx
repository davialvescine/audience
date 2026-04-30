import type { ReactNode } from 'react';
import Script from 'next/script';

import './globals.css';

export const metadata = {
  title: 'Audience',
  description: 'Comentários da audiência ao vivo no telão',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
