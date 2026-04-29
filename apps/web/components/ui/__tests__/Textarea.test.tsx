import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('shows character count when maxLength set', () => {
    render(<Textarea label="x" id="c" maxLength={280} value="hello" onChange={() => {}} />);
    expect(screen.getByText('5 / 280')).toBeInTheDocument();
  });
});
