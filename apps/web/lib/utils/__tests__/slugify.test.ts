import { describe, it, expect } from 'vitest';

import { slugify } from '../slugify';

describe('slugify', () => {
  it('converts to lowercase with hyphens', () => {
    expect(slugify('O Nascer de Uma Geração')).toBe('o-nascer-de-uma-geracao');
  });
  it('removes accents', () => {
    expect(slugify('Coração')).toBe('coracao');
  });
  it('strips special characters', () => {
    expect(slugify('Evento #1!')).toBe('evento-1');
  });
  it('handles empty after sanitize', () => {
    expect(slugify('!!!')).toBe('');
  });
  it('caps at 60 chars', () => {
    expect(slugify('a'.repeat(80)).length).toBe(60);
  });
});
