import { normalize } from './normalize';
import { isStopword } from './stopwords-pt-br';
import { containsProfanity } from './profanity-pt-br';

export type ValidateOptions = {
  filterStopwords?: boolean;
  filterProfanity?: boolean;
  maxLength?: number;
};

export type ValidateResult =
  | { ok: true; word: string }
  | { ok: false; reason: 'empty' | 'too_long' | 'stopword' | 'profanity' };

export function validateWord(input: unknown, opts: ValidateOptions = {}): ValidateResult {
  const filterStopwords = opts.filterStopwords ?? true;
  const filterProfanity = opts.filterProfanity ?? true;
  const maxLength = opts.maxLength ?? 30;

  const word = normalize(input);
  if (!word) return { ok: false, reason: 'empty' };
  if (word.length > maxLength) return { ok: false, reason: 'too_long' };
  if (filterProfanity && containsProfanity(word)) return { ok: false, reason: 'profanity' };
  if (filterStopwords && isStopword(word)) return { ok: false, reason: 'stopword' };
  return { ok: true, word };
}
