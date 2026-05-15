import { describe, it, expect } from 'vitest';
import { createBrowserClient } from '@supabase/ssr';
import { server } from '../server';
import { mockRpc } from '../supabaseRpc';

describe('mockRpc helper', () => {
  it('intercepts an RPC call and returns the stubbed payload', async () => {
    server.use(mockRpc('test_rpc', { data: { ok: true } }));
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error } = await sb.rpc('test_rpc' as never, { p_x: 1 } as never);
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
  });

  it('returns mapped error code/message when error opts provided', async () => {
    server.use(
      mockRpc('test_rpc_err', { status: 400, error: { message: 'rate_limited', code: 'P0003' } }),
    );
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await sb.rpc('test_rpc_err' as never, {} as never);
    expect(error).not.toBeNull();
    expect(error?.message).toBe('rate_limited');
  });
});
