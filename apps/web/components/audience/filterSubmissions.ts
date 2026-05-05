import type { SubmissionStatus } from '@audience/shared-types';

export type SubmissionFilter = {
  tab: 'all' | 'pending' | 'approved' | 'sent' | 'rejected' | 'failed';
  query: string;
};

type Pickable = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
};

function normalize(s: string): string {
  // Lowercase + strip diacritics so "joao" matches "João".
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function filterSubmissions<T extends Pickable>(
  items: readonly T[],
  filter: SubmissionFilter,
): T[] {
  const q = normalize(filter.query.trim());
  return items.filter((it) => {
    if (filter.tab !== 'all' && it.status !== filter.tab) return false;
    if (q.length === 0) return true;
    const haystack = `${normalize(it.name)} ${normalize(it.comment)}`;
    return haystack.includes(q);
  });
}
