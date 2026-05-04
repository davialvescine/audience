import { describe, expect, it } from 'vitest';

import { filterSubmissions, type SubmissionFilter } from '../filterSubmissions';

const items = [
  { id: '1', name: 'Joao', comment: 'oi', status: 'pending' as const },
  { id: '2', name: 'Maria', comment: 'tudo bem', status: 'sent' as const },
  { id: '3', name: 'Pedro', comment: 'ALELUIA', status: 'rejected' as const },
  { id: '4', name: 'João da Silva', comment: 'que evento', status: 'pending' as const },
  { id: '5', name: 'ana', comment: 'falha de teste', status: 'failed' as const },
];

describe('filterSubmissions', () => {
  it('returns all items when filter=all and no query', () => {
    const result = filterSubmissions(items, { tab: 'all', query: '' });
    expect(result).toHaveLength(5);
  });

  it('filters by status tab', () => {
    expect(filterSubmissions(items, { tab: 'pending', query: '' })).toHaveLength(2);
    expect(filterSubmissions(items, { tab: 'sent', query: '' })).toHaveLength(1);
    expect(filterSubmissions(items, { tab: 'failed', query: '' })).toHaveLength(1);
    expect(filterSubmissions(items, { tab: 'rejected', query: '' })).toHaveLength(1);
  });

  it('matches query against name (case-insensitive)', () => {
    const result = filterSubmissions(items, { tab: 'all', query: 'joao' });
    expect(result.map((i) => i.id)).toEqual(['1', '4']);
  });

  it('matches query against comment text', () => {
    const result = filterSubmissions(items, { tab: 'all', query: 'aleluia' });
    expect(result.map((i) => i.id)).toEqual(['3']);
  });

  it('combines tab + query', () => {
    const result = filterSubmissions(items, { tab: 'pending', query: 'silva' });
    expect(result.map((i) => i.id)).toEqual(['4']);
  });

  it('handles diacritics insensitively', () => {
    const result = filterSubmissions(items, { tab: 'all', query: 'jOÃO' });
    expect(result.map((i) => i.id)).toEqual(['1', '4']);
  });
});

describe('SubmissionFilter type contract', () => {
  it('accepts the documented tabs', () => {
    const tabs: SubmissionFilter['tab'][] = ['all', 'pending', 'sent', 'rejected', 'failed'];
    expect(tabs).toHaveLength(5);
  });
});
