import {
  Bebas_Neue,
  DM_Sans,
  Inter,
  Lora,
  Montserrat,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Poppins,
  Roboto_Slab,
  Space_Grotesk,
} from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

// Família principal (Mentimeter-like). Mantém o nome de var antigo
// (--font-wordcloud) usado no wordcloud, e também expõe como
// --font-jakarta pra ser referenciada pelo catálogo de fontes do telão.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' });
const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  variable: '--font-roboto-slab',
  display: 'swap',
});
const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas',
  display: 'swap',
});

const fontVars = [
  jakarta.variable,
  inter.variable,
  montserrat.variable,
  poppins.variable,
  dmSans.variable,
  spaceGrotesk.variable,
  playfair.variable,
  lora.variable,
  robotoSlab.variable,
  bebas.variable,
].join(' ');

export const metadata = {
  title: 'Audience',
  description: 'Comentários da audiência ao vivo no telão',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={fontVars}
      style={{ ['--font-wordcloud' as string]: 'var(--font-jakarta)' }}
    >
      <head>
        {/* Plain <script src> is a resource declaration in React 19 — hoisted and not treated as a renderable child. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
