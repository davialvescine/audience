import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { OnlineBadge } from '../OnlineBadge';

describe('OnlineBadge', () => {
  it('renders the count', () => {
    render(<OnlineBadge count={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('says "pessoa online" in singular when count is 1', () => {
    render(<OnlineBadge count={1} />);
    expect(screen.getByText(/pessoa online/i)).toBeInTheDocument();
    expect(screen.queryByText(/pessoas online/i)).not.toBeInTheDocument();
  });

  it('says "pessoas online" in plural when count is > 1', () => {
    render(<OnlineBadge count={5} />);
    expect(screen.getByText(/pessoas online/i)).toBeInTheDocument();
  });

  it('hides itself when count is 0', () => {
    const { container } = render(<OnlineBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('has accessible aria-label including the count', () => {
    render(<OnlineBadge count={7} />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/7 pessoas online/i),
    );
  });
});
