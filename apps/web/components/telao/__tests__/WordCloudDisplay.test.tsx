import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { WordCloudDisplay } from '../WordCloudDisplay';
import { createFakeChannel } from '../../../test-utils/supabaseChannel';
import * as runLayoutModule from '@/lib/wordcloud/runLayout';
import type { LaidOutWord } from '@/lib/wordcloud/types';

const config = {
  question: 'Qual é a vibe?',
  maxWordsPerSubmission: 1 as const,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#ff0', '#0ff', '#f0f'],
  showTotal: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WordCloudDisplay', () => {
  it('renders the question from config', () => {
    const ch = createFakeChannel();
    render(
      <WordCloudDisplay
        eventId="evt"
        config={config}
        initialEntries={[]}
        channel={ch}
      />,
    );
    expect(screen.getByText('Qual é a vibe?')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    const ch = createFakeChannel();
    render(
      <WordCloudDisplay
        eventId="evt"
        config={config}
        initialEntries={[]}
        channel={ch}
      />,
    );
    expect(screen.getByText(/aguardando palavras/i)).toBeInTheDocument();
  });

  it('renders words returned by runLayout', async () => {
    const laid: LaidOutWord[] = [
      { text: 'amor', count: 3, x: 0, y: 0, fontSize: 80, rotate: 0, colorIdx: 0 },
      { text: 'paz', count: 1, x: 100, y: 50, fontSize: 30, rotate: 0, colorIdx: 1 },
    ];
    const spy = vi.spyOn(runLayoutModule, 'runLayout').mockResolvedValue(laid);

    const ch = createFakeChannel();
    render(
      <WordCloudDisplay
        eventId="evt"
        config={config}
        initialEntries={[
          { text: 'amor', count: 3 },
          { text: 'paz', count: 1 },
        ]}
        channel={ch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('wc-word-amor')).toBeInTheDocument();
      expect(screen.getByTestId('wc-word-paz')).toBeInTheDocument();
    });
    expect(spy).toHaveBeenCalled();
  });

  it('shows total submissions counter when showTotal=true', async () => {
    vi.spyOn(runLayoutModule, 'runLayout').mockResolvedValue([
      { text: 'amor', count: 5, x: 0, y: 0, fontSize: 100, rotate: 0, colorIdx: 0 },
    ]);
    const ch = createFakeChannel();
    render(
      <WordCloudDisplay
        eventId="evt"
        config={config}
        initialEntries={[{ text: 'amor', count: 5 }]}
        channel={ch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/5 palavras/i)).toBeInTheDocument();
    });
  });

  it('hides total counter when showTotal=false', async () => {
    vi.spyOn(runLayoutModule, 'runLayout').mockResolvedValue([
      { text: 'amor', count: 5, x: 0, y: 0, fontSize: 100, rotate: 0, colorIdx: 0 },
    ]);
    const ch = createFakeChannel();
    render(
      <WordCloudDisplay
        eventId="evt"
        config={{ ...config, showTotal: false }}
        initialEntries={[{ text: 'amor', count: 5 }]}
        channel={ch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('wc-word-amor')).toBeInTheDocument();
    });
    expect(screen.queryByText(/palavras enviadas/i)).not.toBeInTheDocument();
  });
});
