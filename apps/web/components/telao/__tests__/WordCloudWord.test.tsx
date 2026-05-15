import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { WordCloudWord } from '../WordCloudWord';
import type { LaidOutWord } from '@/lib/wordcloud/types';

const palette = ['#aaa', '#bbb', '#ccc'];

function w(overrides: Partial<LaidOutWord> = {}): LaidOutWord {
  return {
    text: 'amor',
    count: 5,
    x: 0,
    y: 0,
    fontSize: 60,
    rotate: 0,
    colorIdx: 0,
    ...overrides,
  };
}

describe('WordCloudWord', () => {
  it('renders the word text', () => {
    render(<WordCloudWord word={w()} palette={palette} originX={0} originY={0} />);
    expect(screen.getByText('amor')).toBeInTheDocument();
  });

  it('exposes a stable testid keyed by text', () => {
    render(<WordCloudWord word={w({ text: 'paz' })} palette={palette} originX={0} originY={0} />);
    expect(screen.getByTestId('wc-word-paz')).toBeInTheDocument();
  });

  it('picks color via colorIdx modulo palette length', () => {
    render(<WordCloudWord word={w({ colorIdx: 4 })} palette={palette} originX={0} originY={0} />);
    // colorIdx 4 mod 3 = 1 -> '#bbb'
    const span = screen.getByTestId('wc-word-amor');
    expect(span.getAttribute('style')).toMatch(/#bbb|rgb\(187,\s*187,\s*187\)/);
  });
});
