import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '../../test-utils/msw/server';
import { mockRpc } from '../../test-utils/msw/supabaseRpc';

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { setWordcloudActive, updateWordcloudConfig, resetWordcloud } from '../wordcloud';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';

describe('setWordcloudActive', () => {
  it('returns ok with the updated row when RPC succeeds', async () => {
    server.use(
      mockRpc('set_wordcloud_active', {
        data: { id: 'evt-1', wordcloud_active: true, slug: 'demo' },
      }),
    );
    const r = await setWordcloudActive('evt-1', true);
    expect(r.ok).toBe(true);
  });

  it('maps forbidden error', async () => {
    server.use(
      mockRpc('set_wordcloud_active', {
        status: 403,
        error: { message: 'forbidden', code: '42501' },
      }),
    );
    const r = await setWordcloudActive('evt-1', true);
    expect(r).toEqual({ ok: false, error: 'forbidden' });
  });

  it('sends the right payload', async () => {
    let captured: { p_event_id?: string; p_active?: boolean } | null = null;
    server.use(
      http.post('*/rest/v1/rpc/set_wordcloud_active', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: 'x' });
      }),
    );
    await setWordcloudActive('evt-z', false);
    expect(captured).toEqual({ p_event_id: 'evt-z', p_active: false });
  });
});

describe('updateWordcloudConfig', () => {
  it('forwards the config jsonb verbatim', async () => {
    type Capture = { p_event_id?: string; p_config?: unknown };
    let captured: Capture | null = null;
    server.use(
      http.post('*/rest/v1/rpc/update_wordcloud_config', async ({ request }) => {
        captured = (await request.json()) as Capture;
        return HttpResponse.json({ id: 'x' });
      }),
    );
    const cfg: WordcloudConfig = {
      question: 'oi?',
      maxWordsPerSubmission: 1,
      palette: ['#fff'],
      filterStopwords: true,
      filterProfanity: true,
      showTotal: true,
    };
    await updateWordcloudConfig('evt-z', cfg);
    const c = captured as Capture | null;
    expect(c?.p_event_id).toBe('evt-z');
    expect(c?.p_config).toEqual(cfg);
  });
});

describe('resetWordcloud', () => {
  it('returns ok when reset succeeds', async () => {
    server.use(mockRpc('reset_wordcloud', { data: null }));
    const r = await resetWordcloud('evt-1');
    expect(r.ok).toBe(true);
  });

  it('maps unknown error', async () => {
    server.use(
      mockRpc('reset_wordcloud', { status: 500, error: { message: 'boom', code: 'XX000' } }),
    );
    const r = await resetWordcloud('evt-1');
    expect(r).toEqual({ ok: false, error: 'unknown' });
  });
});
