import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WordCloudInput } from '../WordCloudInput';
import * as submitWordModule from '@/server-actions/submitWord';

const baseConfig = {
  question: 'Em uma palavra, como está o evento?',
  maxWordsPerSubmission: 1 as const,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#fff'],
  showTotal: true,
};

describe('WordCloudInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the question from config', () => {
    render(<WordCloudInput slug="evt" config={baseConfig} />);
    expect(screen.getByText('Em uma palavra, como está o evento?')).toBeInTheDocument();
  });

  it('renders one input by default and calls submitWord on submit', async () => {
    const spy = vi.spyOn(submitWordModule, 'submitWord').mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<WordCloudInput slug="evt" config={baseConfig} />);

    const input = screen.getByLabelText(/sua palavra/i) as HTMLInputElement;
    await user.type(input, 'amor');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const [slug, fd] = spy.mock.calls[0]!;
    expect(slug).toBe('evt');
    expect((fd as FormData).get('word')).toBe('amor');
  });

  it('shows success state on ok=true', async () => {
    vi.spyOn(submitWordModule, 'submitWord').mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<WordCloudInput slug="evt" config={baseConfig} />);
    await user.type(screen.getByLabelText(/sua palavra/i), 'amor');
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByText(/recebido/i)).toBeInTheDocument();
  });

  it('shows skipped state when server returns ok+skipped', async () => {
    vi.spyOn(submitWordModule, 'submitWord').mockResolvedValue({ ok: true, skipped: true });
    const user = userEvent.setup();
    render(<WordCloudInput slug="evt" config={baseConfig} />);
    await user.type(screen.getByLabelText(/sua palavra/i), 'de');
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    // Stopword path: silent skip, but UX should still acknowledge
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows translated error for rate_limited', async () => {
    vi.spyOn(submitWordModule, 'submitWord').mockResolvedValue({ ok: false, error: 'rate_limited' });
    const user = userEvent.setup();
    render(<WordCloudInput slug="evt" config={baseConfig} />);
    await user.type(screen.getByLabelText(/sua palavra/i), 'amor');
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/aguarde/i);
  });

  it('shows translated error for profanity', async () => {
    vi.spyOn(submitWordModule, 'submitWord').mockResolvedValue({ ok: false, error: 'profanity' });
    const user = userEvent.setup();
    render(<WordCloudInput slug="evt" config={baseConfig} />);
    await user.type(screen.getByLabelText(/sua palavra/i), 'puta');
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/não aceita|nao aceita/i);
  });

  it('disables submit while pending', async () => {
    const deferred: { resolve?: (v: { ok: true }) => void } = {};
    vi.spyOn(submitWordModule, 'submitWord').mockReturnValue(
      new Promise<{ ok: true }>((res) => {
        deferred.resolve = res;
      }),
    );
    const user = userEvent.setup();
    render(<WordCloudInput slug="evt" config={baseConfig} />);
    await user.type(screen.getByLabelText(/sua palavra/i), 'amor');
    const btn = screen.getByRole('button', { name: /enviar/i });
    await user.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    deferred.resolve!({ ok: true });
  });

  it('requires a value (button does nothing on empty input)', async () => {
    const spy = vi.spyOn(submitWordModule, 'submitWord');
    const user = userEvent.setup();
    render(<WordCloudInput slug="evt" config={baseConfig} />);
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    expect(spy).not.toHaveBeenCalled();
  });
});
