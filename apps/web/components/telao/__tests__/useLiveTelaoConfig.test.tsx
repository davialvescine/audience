import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';

import { useLiveTelaoConfig } from '../useLiveTelaoConfig';

// Captured by the supabase mock so tests can fire fake postgres_changes
// payloads at the subscribed callback.
let capturedHandler: ((payload: { new: { telao_config: TelaoConfig } }) => void) | null = null;
const removeChannelSpy = vi.fn();

vi.mock('@/lib/supabase/browser', () => {
  return {
    getSupabaseBrowserClient: () => ({
      channel: (_name: string) => {
        const ch: {
          on: (
            type: string,
            filter: object,
            cb: (payload: { new: { telao_config: TelaoConfig } }) => void,
          ) => typeof ch;
          subscribe: () => typeof ch;
        } = {
          on: (_type, _filter, cb) => {
            capturedHandler = cb;
            return ch;
          },
          subscribe: () => ch,
        };
        return ch;
      },
      removeChannel: removeChannelSpy,
    }),
  };
});

function Probe({
  eventId,
  initial,
}: {
  eventId: string;
  initial: TelaoConfig;
}) {
  const config = useLiveTelaoConfig(eventId, initial);
  return <span data-testid="bg">{config.cardBg}</span>;
}

describe('useLiveTelaoConfig', () => {
  beforeEach(() => {
    capturedHandler = null;
    removeChannelSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the initial config on first render', () => {
    render(<Probe eventId="evt-1" initial={DEFAULT_TELAO_CONFIG} />);
    expect(screen.getByTestId('bg').textContent).toBe(DEFAULT_TELAO_CONFIG.cardBg);
  });

  it('subscribes to postgres_changes and updates when an UPDATE arrives', () => {
    render(<Probe eventId="evt-1" initial={DEFAULT_TELAO_CONFIG} />);
    expect(capturedHandler).not.toBeNull();

    act(() => {
      capturedHandler!({
        new: {
          telao_config: { ...DEFAULT_TELAO_CONFIG, cardBg: '#FFFFFF' },
        },
      });
    });

    expect(screen.getByTestId('bg').textContent).toBe('#FFFFFF');
  });

  it('removes the channel on unmount', () => {
    const { unmount } = render(<Probe eventId="evt-1" initial={DEFAULT_TELAO_CONFIG} />);
    unmount();
    expect(removeChannelSpy).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when enabled is false', () => {
    function Disabled() {
      const cfg = useLiveTelaoConfig('evt-1', DEFAULT_TELAO_CONFIG, false);
      return <span data-testid="bg">{cfg.cardBg}</span>;
    }
    render(<Disabled />);
    expect(capturedHandler).toBeNull();
  });
});
