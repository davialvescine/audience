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
  return (
    <motion.span
      data-testid={`wc-word-${word.text}`}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: 1,
        left: originX + word.x,
        top: originY + word.y,
        fontSize: word.fontSize,
        rotate: word.rotate,
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 200 }}
      style={{
        position: 'absolute',
        color,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 700,
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
