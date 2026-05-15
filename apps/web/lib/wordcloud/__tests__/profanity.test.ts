import { describe, it, expect } from 'vitest';
import { containsProfanity, PROFANITY } from '../profanity-pt-br';

describe('pt-BR profanity filter', () => {
  it('flags entries from the conservative list', () => {
    for (const w of PROFANITY) {
      expect(containsProfanity(w), `expected "${w}" to be flagged`).toBe(true);
    }
  });

  it('flags common spelling with diacritics after normalization', () => {
    // Callers pass normalize(input), but containsProfanity should still
    // catch diacritic variants to be defensive.
    expect(containsProfanity('puta')).toBe(true);
    expect(containsProfanity('pütã')).toBe(true);
  });

  it('does NOT flag neutral words', () => {
    for (const w of ['amor', 'paz', 'vida', 'futuro', 'casa', 'rua', 'brasil']) {
      expect(containsProfanity(w), `expected "${w}" to pass`).toBe(false);
    }
  });

  it('is case-insensitive', () => {
    expect(containsProfanity('PUTA')).toBe(true);
  });

  it('returns false for empty input', () => {
    expect(containsProfanity('')).toBe(false);
  });

  it('does not match substrings within larger neutral words', () => {
    // Adversarial: "caralho" should hit but "carteira" should not just because
    // it shares letters. We match whole words (post-normalization), not substrings.
    expect(containsProfanity('carteira')).toBe(false);
    expect(containsProfanity('paciencia')).toBe(false);
  });
});
