'use client';

import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

import { WordCloudWord } from '@/components/telao/WordCloudWord';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { useWordCounts } from '@/hooks/useWordCounts';
import { runLayout } from '@/lib/wordcloud/runLayout';
import type { LaidOutWord, WordEntry } from '@/lib/wordcloud/types';

const STAGE_W = 1920;
const STAGE_H = 1080;
const HEADER_H = 160;
const CLOUD_H = STAGE_H - HEADER_H;

type ChannelLike = Parameters<typeof useWordCounts>[1]['channel'];

type Props = {
  eventId: string;
  config: WordcloudConfig;
  initialEntries: WordEntry[];
  channel: ChannelLike;
};

export function WordCloudDisplay({ eventId, config, initialEntries, channel }: Props) {
  const { entries, totalSubmissions } = useWordCounts(eventId, {
    channel,
    initialEntries,
  });
  const [laid, setLaid] = useState<LaidOutWord[]>([]);

  useEffect(() => {
    if (!entries.length) {
      setLaid([]);
      return;
    }
    let cancelled = false;
    runLayout({
      entries,
      width: STAGE_W,
      height: CLOUD_H,
      paletteSize: config.palette.length,
    })
      .then((w) => {
        if (!cancelled) setLaid(w);
      })
      .catch((e) => {
        // Layout failure is non-fatal — keep last layout visible.
        // eslint-disable-next-line no-console
        console.warn('wordcloud layout failed', e);
      });
    return () => {
      cancelled = true;
    };
  }, [entries, config.palette.length]);

  return (
    <div className="absolute inset-0 overflow-hidden text-paper">
      <header className="relative z-10 px-12 pt-12 text-center">
        <h1
          className="text-5xl md:text-6xl font-display font-bold drop-shadow-lg"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {config.question}
        </h1>
        {config.showTotal && entries.length > 0 ? (
          <p className="mt-4 text-2xl opacity-80">
            {totalSubmissions} palavras enviadas
          </p>
        ) : null}
      </header>

      <div
        className="absolute left-0 right-0"
        style={{ top: HEADER_H, height: CLOUD_H }}
      >
        <AnimatePresence>
          {laid.map((w) => (
            <WordCloudWord
              key={w.text}
              word={w}
              palette={config.palette}
              originX={STAGE_W / 2}
              originY={CLOUD_H / 2}
            />
          ))}
        </AnimatePresence>

        {entries.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-paper/70 text-3xl text-center px-12">
            Aguardando palavras... Envie pelo celular ↓
          </div>
        ) : null}
      </div>
    </div>
  );
}
