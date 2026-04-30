import type { ReactNode } from 'react';

import './globals.css';

export const metadata = {
  title: 'Audience',
  description: 'Comentários da audiência ao vivo no telão',
};

const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = saved === 'system' ? (prefersDark ? 'dark' : 'light') : saved;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
