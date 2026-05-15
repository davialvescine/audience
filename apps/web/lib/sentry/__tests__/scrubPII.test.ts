import { describe, expect, it } from 'vitest';

import { scrubPII } from '../scrubPII';

describe('scrubPII', () => {
  it('returns the event unchanged when there is no PII', () => {
    const ev = { message: 'unrelated error' } as const;
    expect(scrubPII({ ...ev })).toEqual(ev);
  });

  it('redacts user.email when present', () => {
    const result = scrubPII({
      user: { id: 'u1', email: 'a@b.com', username: 'alice' },
    });
    expect(result.user).toEqual({ id: 'u1', email: '[redacted]', username: '[redacted]' });
  });

  it('drops form_data values from request body', () => {
    const result = scrubPII({
      request: {
        url: '/x',
        data: { name: 'Joao', comment: 'Algo privado' },
      },
    });
    expect(result.request?.data).toEqual({ name: '[redacted]', comment: '[redacted]' });
  });

  it('redacts comment-like keys deep in extra/contexts', () => {
    const result = scrubPII({
      extra: {
        payload: { comment: 'segredo', name: 'José', other: 'ok' },
      },
    });
    expect(result.extra?.payload).toEqual({
      comment: '[redacted]',
      name: '[redacted]',
      other: 'ok',
    });
  });

  it('returns null when event is null', () => {
    expect(scrubPII(null)).toBeNull();
  });
});
