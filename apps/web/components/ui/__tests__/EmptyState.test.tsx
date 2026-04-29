import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Vazio" description="Nada aqui ainda" />);
    expect(screen.getByText('Vazio')).toBeInTheDocument();
    expect(screen.getByText('Nada aqui ainda')).toBeInTheDocument();
  });
});
