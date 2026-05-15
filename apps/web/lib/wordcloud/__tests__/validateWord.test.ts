import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateWord } from '../validateWord';

describe('validateWord', () => {
  it('accepts a clean lowercase word', () => {
    expect(validateWord('amor')).toEqual({ ok: true, word: 'amor' });
  });

  it('normalizes the input (diacritics + case + whitespace)', () => {
    expect(validateWord('  AÇAÍ ')).toEqual({ ok: true, word: 'acai' });
  });

  it('rejects empty / whitespace-only input as "empty"', () => {
    expect(validateWord('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateWord('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects words longer than 30 chars after normalization as "too_long"', () => {
    const long = 'a'.repeat(31);
    expect(validateWord(long)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('rejects stopwords as "stopword" when filter enabled (default)', () => {
    expect(validateWord('de')).toEqual({ ok: false, reason: 'stopword' });
    expect(validateWord('que')).toEqual({ ok: false, reason: 'stopword' });
  });

  it('keeps stopwords when filterStopwords=false', () => {
    expect(validateWord('de', { filterStopwords: false })).toEqual({ ok: true, word: 'de' });
  });

  it('rejects profanity as "profanity"', () => {
    expect(validateWord('puta')).toEqual({ ok: false, reason: 'profanity' });
  });

  it('skips profanity check when filterProfanity=false', () => {
    // Still rejects via fallback (e.g., stopword) wouldn't apply; just allows it.
    expect(validateWord('puta', { filterProfanity: false })).toEqual({ ok: true, word: 'puta' });
  });

  it('property: never throws on arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        validateWord(s);
        return true;
      }),
    );
  });

  it('property: output is either {ok:true, word} or {ok:false, reason}', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const r = validateWord(s);
        if (r.ok) return typeof r.word === 'string' && r.word.length > 0;
        return ['empty', 'too_long', 'stopword', 'profanity'].includes(r.reason);
      }),
    );
  });
});
