import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders correct label per status', () => {
    render(<Badge status="sent" />);
    expect(screen.getByText('No telão')).toBeInTheDocument();
  });
});
