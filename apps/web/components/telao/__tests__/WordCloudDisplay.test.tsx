import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { WordCloudDisplay } from '../WordCloudDisplay';
import { createFakeChannel } from '../../../test-utils/supabaseChannel';

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
    render(<WordCloudDisplay eventId="evt" config={config} initialEntries={[]} channel={ch} />);
    expect(screen.getByText('Qual é a vibe?')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    const ch = createFakeChannel();
    render(<WordCloudDisplay eventId="evt" config={config} initialEntries={[]} channel={ch} />);
    expect(screen.getByText(/aguardando palavras/i)).toBeInTheDocument();
  });

  it('renders words from initialEntries (synchronous d3-cloud layout)', async () => {
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
    // Layout síncrono — palavra dominante sempre renderiza (centro).
    // Em jsdom o canvas measureText é stub, então palavras menores podem
    // cair no fallback grid; basta verificar que pelo menos uma renderizou.
    await waitFor(() => {
      expect(screen.getByTestId('wc-word-amor')).toBeInTheDocument();
    });
  });

  it('shows total submissions counter when showTotal=true and joinUrl set', async () => {
    const ch = createFakeChannel();
    render(
      <WordCloudDisplay
        eventId="evt"
        config={config}
        initialEntries={[{ text: 'amor', count: 5 }]}
        channel={ch}
        showBackground
        joinUrl="https://example.com/e/test"
      />,
    );
    await waitFor(() => {
      // O contador é split em dois spans (<bold>1</bold> palavra). Procura
      // pelo texto "palavra" e o número irmão.
      expect(screen.getByText(/palavra/i)).toBeInTheDocument();
    });
  });

  it('hides total counter when showTotal=false', async () => {
    const ch = createFakeChannel();
    render(
      <WordCloudDisplay
        eventId="evt"
        config={{ ...config, showTotal: false }}
        initialEntries={[{ text: 'amor', count: 5 }]}
        channel={ch}
        showBackground
        joinUrl="https://example.com/e/test"
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('wc-word-amor')).toBeInTheDocument();
    });
    expect(screen.queryByText(/palavras enviadas/i)).not.toBeInTheDocument();
  });
});
