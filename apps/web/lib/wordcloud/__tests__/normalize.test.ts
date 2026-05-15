import { describe, it, expect } from 'vitest';
import { normalize } from '../normalize';

describe('normalize', () => {
  it('lowercases ascii', () => {
    expect(normalize('AMOR')).toBe('amor');
  });

  it('strips diacritics (NFD + Mn)', () => {
    expect(normalize('São')).toBe('sao');
    expect(normalize('coração')).toBe('coracao');
    expect(normalize('Açaí')).toBe('acai');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalize('  paz  ')).toBe('paz');
  });

  it('collapses internal whitespace runs', () => {
    expect(normalize('boa   noite')).toBe('boa noite');
    expect(normalize('a\tb')).toBe('a b');
  });

  it('removes zero-width characters', () => {
    expect(normalize('amor​')).toBe('amor');
    expect(normalize('﻿abc')).toBe('abc');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalize('   ')).toBe('');
    expect(normalize('')).toBe('');
  });

  it('preserves internal hyphens', () => {
    expect(normalize('pé-de-moleque')).toBe('pe-de-moleque');
  });

  it('handles non-string input gracefully', () => {
    // @ts-expect-error - intentionally exercising the runtime guard
    expect(normalize(null)).toBe('');
    // @ts-expect-error - intentionally exercising the runtime guard
    expect(normalize(undefined)).toBe('');
  });
});
