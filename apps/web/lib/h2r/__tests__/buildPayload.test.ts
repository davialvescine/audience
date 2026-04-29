import { describe, it, expect } from 'vitest';

import { buildH2RPayload } from '../buildPayload';

describe('buildH2RPayload', () => {
  it('produces messages array with required shape', () => {
    const payload = buildH2RPayload({
      submissionId: '11111111-1111-1111-1111-111111111111',
      eventName: 'Evento X',
      name: 'João',
      comment: 'Olá!',
      timestampMs: 1_700_000_000_000,
    });
    expect(payload).toEqual({
      messages: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          timestamp: 1_700_000_000,
          snippet: { displayMessage: 'Olá!' },
          authorDetails: { displayName: 'João', profileImageUrl: '' },
          platform: { name: 'Evento X', logoUrl: '' },
        },
      ],
    });
  });
});
