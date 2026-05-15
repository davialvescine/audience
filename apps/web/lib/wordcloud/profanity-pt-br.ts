import { normalize } from './normalize';

// Conservative pt-BR profanity list (already normalized: lowercase, no
// diacritics, no separators). Includes the obvious surname-level slurs and
// xingamentos; deliberately keeps the list short to avoid false positives.
// All comparisons run against normalize(input) so diacritic variants
// (e.g. "pütã") still match.

export const PROFANITY: ReadonlySet<string> = new Set([
  'puta',
  'putas',
  'putao',
  'putaria',
  'caralho',
  'caralhos',
  'porra',
  'porras',
  'merda',
  'merdas',
  'foda',
  'fodase',
  'fodase',
  'fodido',
  'fodida',
  'fudeu',
  'cu',
  'cuzao',
  'cuzeiro',
  'cacete',
  'cacetes',
  'piroca',
  'pirocas',
  'pinto',
  'piroco',
  'buceta',
  'bucetas',
  'rola',
  'rolas',
  'viado',
  'viados',
  'bicha',
  'bichas',
  'baitola',
  'corno',
  'cornos',
  'arrombado',
  'arrombada',
  'desgracado',
  'desgracada',
  'otario',
  'otaria',
  'cuzinho',
  'safado',
  'safada',
  'putinha',
  'putona',
]);

export function containsProfanity(word: string): boolean {
  if (!word) return false;
  const n = normalize(word);
  if (!n) return false;
  return PROFANITY.has(n);
}
