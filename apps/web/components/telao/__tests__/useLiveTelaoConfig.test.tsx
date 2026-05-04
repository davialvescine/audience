import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';

import { useLiveTelaoConfig } from '../useLiveTelaoConfig';

let rpcResponses: Array<{ config: Partial<TelaoConfig> | null }> = [];
const rpcCalls: Array<{ name: string; args: unknown }> = [];

vi.mock('@/lib/supabase/browser', () => {
  return {
    getSupabaseBrowserClient: () => ({
      rpc: (name: string, args: unknown) => {
        rpcCalls.push({ name, args });
        const next = rpcResponses.shift() ?? rpcResponses[rpcResponses.length - 1] ?? { config: null };
        return Promise.resolve({
          data: next.config ? [{ event_id: 'evt-1', event_name: 'X', theme_id: 't', config: next.config }] : [],
          error: null,
        });
      },
    }),
  };
});

function Probe({
  slug,
  initial,
  enabled = true,
}: {
  slug: string;
  initial: TelaoConfig;
  enabled?: boolean;
}) {
  const config = useLiveTelaoConfig(slug, initial, enabled);
  return <span data-testid="bg">{config.cardBg}</span>;
}

describe('useLiveTelaoConfig', () => {
  beforeEach(() => {
    rpcResponses = [];
    rpcCalls.length = 0;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns initial config on first render', () => {
    render(<Probe slug="ev-1" initial={DEFAULT_TELAO_CONFIG} />);
    expect(screen.getByTestId('bg').textContent).toBe(DEFAULT_TELAO_CONFIG.cardBg);
  });

  it('polls get_telao_config and updates state when config changes', async () => {
    rpcResponses = [{ config: { cardBg: '#FFFFFF' } }];
    render(<Probe slug="ev-1" initial={DEFAULT_TELAO_CONFIG} />);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await waitFor(() => {
      expect(screen.getByTestId('bg').textContent).toBe('#FFFFFF');
    });
    expect(rpcCalls.some((c) => c.name === 'get_telao_config')).toBe(true);
  });

  it('does not poll when enabled is false', async () => {
    render(<Probe slug="ev-1" initial={DEFAULT_TELAO_CONFIG} enabled={false} />);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(rpcCalls.length).toBe(0);
  });
});
