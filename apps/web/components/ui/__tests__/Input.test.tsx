import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Input } from '../Input';

describe('Input', () => {
  it('renders label associated with input', () => {
    render(<Input label="Nome" id="name" />);
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Input label="Nome" id="name" error="obrigatório" />);
    expect(screen.getByText('obrigatório')).toBeInTheDocument();
  });

  it('marks aria-invalid when error present', () => {
    render(<Input label="Nome" id="name" error="x" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
