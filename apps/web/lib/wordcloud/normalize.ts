// Word normalization for the wordcloud interaction.
// Lowercase + strip diacritics + drop control/zero-width + collapse whitespace.
// "São" and "sao" must collapse to the same bucket so we don't double-count.

export function normalize(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .toLowerCase()
    .trim();
}
