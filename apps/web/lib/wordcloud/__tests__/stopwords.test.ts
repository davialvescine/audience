import { describe, it, expect } from 'vitest';
import { isStopword, STOPWORDS } from '../stopwords-pt-br';

describe('pt-BR stopwords', () => {
  it('flags common articles, prepositions, and conjunctions', () => {
    for (const w of ['a', 'o', 'de', 'da', 'do', 'que', 'e', 'um', 'uma', 'em', 'para', 'com', 'por', 'na', 'no']) {
      expect(isStopword(w), `expected "${w}" to be a stopword`).toBe(true);
    }
  });

  it('does not flag content words', () => {
    for (const w of ['amor', 'paz', 'brasil', 'vida', 'obrigado', 'inteligencia', 'futuro']) {
      expect(isStopword(w), `expected "${w}" to NOT be a stopword`).toBe(false);
    }
  });

  it('is case-insensitive', () => {
    expect(isStopword('DE')).toBe(true);
    expect(isStopword('De')).toBe(true);
  });

  it('matches against already-normalized input only (no diacritics)', () => {
    // Caller is expected to pass normalize(x). Stopword list itself is ASCII.
    expect(isStopword('voce')).toBe(true);
    expect(isStopword('e')).toBe(true);
  });

  it('exports a Set with at least 100 entries', () => {
    expect(STOPWORDS).toBeInstanceOf(Set);
    expect(STOPWORDS.size).toBeGreaterThan(100);
  });

  it('returns false for empty input', () => {
    expect(isStopword('')).toBe(false);
  });
});
