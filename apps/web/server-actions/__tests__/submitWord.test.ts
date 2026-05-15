import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/msw/server';
import { mockRpc } from '../../test-utils/msw/supabaseRpc';

// Mock next/headers BEFORE importing the action (top-level vi.mock is hoisted).
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => (key === 'x-forwarded-for' ? '203.0.113.7' : null),
  }),
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// Re-import after mocks are set
import { submitWord } from '../submitWord';

function fd(word: string): FormData {
  const f = new FormData();
  f.set('word', word);
  return f;
}

describe('submitWord server action', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('returns ok when RPC succeeds', async () => {
    server.use(mockRpc('submit_word', { data: { ok: true } }));
    const r = await submitWord('my-event', fd('amor'));
    expect(r).toEqual({ ok: true });
  });

  it('normalizes input before sending', async () => {
    let captured: { p_word?: string; p_slug?: string; p_ip_hash?: string } | null = null;
    server.use(
      http.post('*/rest/v1/rpc/submit_word', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ ok: true });
      }),
    );
    await submitWord('evt-x', fd('  AÇAÍ '));
    expect(captured).not.toBeNull();
    expect(captured!.p_word).toBe('acai');
    expect(captured!.p_slug).toBe('evt-x');
    expect(typeof captured!.p_ip_hash).toBe('string');
  });

  it('returns skipped:true for empty / whitespace-only', async () => {
    // No RPC handler — if action tries to call, test fails (MSW unhandled = error).
    const r = await submitWord('evt', fd('   '));
    expect(r).toEqual({ ok: true, skipped: true });
  });

  it('returns skipped:true for stopwords (silent reject)', async () => {
    const r = await submitWord('evt', fd('de'));
    expect(r).toEqual({ ok: true, skipped: true });
  });

  it('returns error=profanity explicitly', async () => {
    const r = await submitWord('evt', fd('puta'));
    expect(r).toEqual({ ok: false, error: 'profanity' });
  });

  it('maps rate_limited error from RPC', async () => {
    server.use(
      mockRpc('submit_word', { status: 400, error: { message: 'rate_limited', code: 'P0003' } }),
    );
    const r = await submitWord('evt', fd('amor'));
    expect(r).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('maps wordcloud_inactive error from RPC', async () => {
    server.use(
      mockRpc('submit_word', {
        status: 400,
        error: { message: 'wordcloud_inactive', code: 'P0001' },
      }),
    );
    const r = await submitWord('evt', fd('amor'));
    expect(r).toEqual({ ok: false, error: 'wordcloud_inactive' });
  });

  it('maps event_not_found error from RPC', async () => {
    server.use(
      mockRpc('submit_word', { status: 400, error: { message: 'event_not_found', code: 'P0002' } }),
    );
    const r = await submitWord('evt', fd('amor'));
    expect(r).toEqual({ ok: false, error: 'event_not_found' });
  });

  it('falls back to unknown on unmapped error', async () => {
    server.use(mockRpc('submit_word', { status: 500, error: { message: 'boom', code: 'XX000' } }));
    const r = await submitWord('evt', fd('amor'));
    expect(r).toEqual({ ok: false, error: 'unknown' });
  });
});
