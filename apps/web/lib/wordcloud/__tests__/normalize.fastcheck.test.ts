import { describe, it } from 'vitest';
import fc from 'fast-check';
import { normalize } from '../normalize';

describe('normalize properties', () => {
  it('is idempotent (normalize ∘ normalize = normalize)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => normalize(normalize(s)) === normalize(s)),
    );
  });

  it('never grows the input length', () => {
    fc.assert(
      fc.property(fc.string(), (s) => normalize(s).length <= s.length),
    );
  });

  it('output has no leading or trailing ASCII whitespace', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = normalize(s);
        return out === '' || (out[0] !== ' ' && out[out.length - 1] !== ' ');
      }),
    );
  });

  it('output is its own lowercase', () => {
    fc.assert(
      fc.property(fc.string(), (s) => normalize(s) === normalize(s).toLowerCase()),
    );
  });

  it('output contains no consecutive whitespace runs', () => {
    fc.assert(
      fc.property(fc.string(), (s) => !/ {2,}/.test(normalize(s))),
    );
  });
});
