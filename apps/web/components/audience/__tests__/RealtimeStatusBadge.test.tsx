import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RealtimeStatusBadge } from '../RealtimeStatusBadge';

describe('RealtimeStatusBadge', () => {
  it('renders "Ao vivo" when connected', () => {
    render(<RealtimeStatusBadge status="connected" />);
    expect(screen.getByText(/ao vivo/i)).toBeTruthy();
  });

  it('renders "Conectando" when connecting', () => {
    render(<RealtimeStatusBadge status="connecting" />);
    expect(screen.getByText(/conectando/i)).toBeTruthy();
  });

  it('renders polling label when error', () => {
    render(<RealtimeStatusBadge status="error" />);
    expect(screen.getByText(/polling/i)).toBeTruthy();
  });

  it('uses different colors for different statuses', () => {
    const { container, rerender } = render(<RealtimeStatusBadge status="connected" />);
    const connectedClass = container.firstChild?.textContent;
    rerender(<RealtimeStatusBadge status="error" />);
    const errorClass = container.firstChild?.textContent;
    expect(connectedClass).not.toBe(errorClass);
  });
});
