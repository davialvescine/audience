'use client';

import { motion } from 'framer-motion';

import type { LaidOutWord } from '@/lib/wordcloud/types';

type Props = {
  word: LaidOutWord;
  palette: string[];
  originX: number;
  originY: number;
};

export function WordCloudWord({ word, palette, originX, originY }: Props) {
  const color = palette[word.colorIdx % palette.length] ?? '#fff';
  // Peso varia com tamanho — palavra dominante fica bold pesado, palavras
  // pequenas ficam mais leves (estilo Mentimeter). Threshold em fontSize:
  // ≥120 = 800, ≥80 = 700, ≥56 = 600, senão 500.
  const fontWeight =
    word.fontSize >= 120 ? 800 : word.fontSize >= 80 ? 700 : word.fontSize >= 56 ? 600 : 500;
  return (
    <motion.span
      data-testid={`wc-word-${word.text}`}
      initial={{
        opacity: 0,
        // fontSize idêntico ao final pra evitar "pequeno → grande" no primeiro
        // render (era undefined, animava do 0 ao fontSize do d3-cloud).
        fontSize: word.fontSize,
        left: originX + word.x,
        top: originY + word.y,
        rotate: word.rotate,
      }}
      animate={{
        opacity: 1,
        left: originX + word.x,
        top: originY + word.y,
        fontSize: word.fontSize,
        rotate: word.rotate,
      }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 220, mass: 0.7 }}
      style={{
        position: 'absolute',
        color,
        fontFamily: 'var(--font-wordcloud), "Plus Jakarta Sans", Inter, system-ui, sans-serif',
        fontWeight,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        x: '-50%',
        y: '-50%',
        willChange: 'transform, opacity, font-size',
      }}
    >
      {word.text}
    </motion.span>
  );
}
