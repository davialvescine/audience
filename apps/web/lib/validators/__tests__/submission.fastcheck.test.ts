import { describe, it } from 'vitest';
import fc from 'fast-check';
import { sanitizeText } from '../submission';

describe('sanitizeText properties', () => {
  it('is idempotent', () => {
    fc.assert(fc.property(fc.string(), (s) => sanitizeText(sanitizeText(s)) === sanitizeText(s)));
  });

  it('never grows the input length', () => {
    fc.assert(fc.property(fc.string(), (s) => sanitizeText(s).length <= s.length));
  });

  it('output has no leading or trailing whitespace', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = sanitizeText(s);
        return out === '' || (out[0] !== ' ' && out[out.length - 1] !== ' ');
      }),
    );
  });
});
