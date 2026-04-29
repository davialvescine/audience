import type { ReactNode } from 'react';

import './globals.css';

export const metadata = {
  title: 'Audience',
  description: 'Live audience moderation for events',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
