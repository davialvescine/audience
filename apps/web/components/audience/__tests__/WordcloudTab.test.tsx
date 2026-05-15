import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WordcloudTab } from '../WordcloudTab';
import * as actions from '@/server-actions/wordcloud';

const baseConfig = {
  question: 'pergunta inicial',
  maxWordsPerSubmission: 1 as const,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#fff'],
  showTotal: true,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('WordcloudTab', () => {
  it('renders the toggle with initial off state', () => {
    render(
      <WordcloudTab
        eventId="evt-1"
        initialActive={false}
        initialConfig={baseConfig}
      />,
    );
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls setWordcloudActive when toggled on', async () => {
    const spy = vi.spyOn(actions, 'setWordcloudActive').mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <WordcloudTab
        eventId="evt-1"
        initialActive={false}
        initialConfig={baseConfig}
      />,
    );
    await user.click(screen.getByRole('switch'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('evt-1', true));
  });

  it('shows the active banner when active=true', () => {
    render(
      <WordcloudTab
        eventId="evt-1"
        initialActive={true}
        initialConfig={baseConfig}
      />,
    );
    expect(screen.getByText(/nuvem ativa/i)).toBeInTheDocument();
  });

  it('saves config edits via debounced autosave', async () => {
    const spy = vi.spyOn(actions, 'updateWordcloudConfig').mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <WordcloudTab
        eventId="evt-1"
        initialActive={true}
        initialConfig={baseConfig}
      />,
    );

    const questionInput = screen.getByLabelText(/pergunta/i);
    await user.clear(questionInput);
    await user.type(questionInput, 'Nova pergunta?');

    // Debounce is ~600ms; allow up to 1.5s to coalesce the keystrokes.
    await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 1500 });
    const lastCall = spy.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe('evt-1');
    expect(lastCall[1].question).toBe('Nova pergunta?');
  });

  it('calls resetWordcloud after confirm', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const spy = vi.spyOn(actions, 'resetWordcloud').mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <WordcloudTab
        eventId="evt-1"
        initialActive={true}
        initialConfig={baseConfig}
      />,
    );
    await user.click(screen.getByRole('button', { name: /limpar nuvem/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('evt-1'));
    vi.unstubAllGlobals();
  });

  it('does NOT reset when confirm is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const spy = vi.spyOn(actions, 'resetWordcloud').mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <WordcloudTab
        eventId="evt-1"
        initialActive={true}
        initialConfig={baseConfig}
      />,
    );
    await user.click(screen.getByRole('button', { name: /limpar nuvem/i }));
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
