import { describe, it, expect } from 'vitest';

import { submissionSchema, sanitizeText } from '../submission';

describe('submissionSchema', () => {
  it('accepts valid input', () => {
    expect(submissionSchema.safeParse({ name: 'João', comment: 'Tudo bem!' }).success).toBe(true);
  });
  it('aceita nome vazio e converte pra "Anônimo"', () => {
    const r = submissionSchema.safeParse({ name: '', comment: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Anônimo');
  });
  it('converte nome com só whitespace pra "Anônimo"', () => {
    const r = submissionSchema.safeParse({ name: '   ', comment: 'x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Anônimo');
  });
  it('rejects 281-char comment', () => {
    expect(submissionSchema.safeParse({ name: 'a', comment: 'a'.repeat(281) }).success).toBe(false);
  });
  it('rejects 61-char name', () => {
    expect(submissionSchema.safeParse({ name: 'a'.repeat(61), comment: 'x' }).success).toBe(false);
  });
});

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<b>oi</b>')).toBe('oi');
  });
  it('collapses whitespace', () => {
    expect(sanitizeText('  hi   there  ')).toBe('hi there');
  });
  it('strips zero-width characters', () => {
    expect(sanitizeText('a​b')).toBe('ab');
  });
});
