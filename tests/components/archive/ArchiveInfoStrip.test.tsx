// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArchiveInfoStrip } from '@/components/archive/ArchiveInfoStrip';

/**
 * Winning direction from explorations/guest-archive-identity-lab (Option 3:
 * Hairline Info Strip) — see DECISION.md there. Regression coverage for
 * linejam-942 acceptance: the archive entry point must always explain what
 * signing in adds for a guest, and must never depend on an auth wall.
 */
describe('ArchiveInfoStrip', () => {
  it('renders nothing for a signed-in user with no poems yet', () => {
    const { container } = render(
      <ArchiveInfoStrip isAuthenticated hasPoems={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the reveal hint (no guest copy) for a signed-in user with poems', () => {
    render(<ArchiveInfoStrip isAuthenticated hasPoems />);
    expect(
      screen.getByText(/tap any poem to reveal the full verse/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
  });

  it('explains the guest tradeoff even with zero poems (never a dead end)', () => {
    render(<ArchiveInfoStrip isAuthenticated={false} hasPoems={false} />);
    expect(screen.getByText(/saved to this browser only/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
  });

  it('shows both the reveal hint and the guest explainer for a guest with poems', () => {
    render(<ArchiveInfoStrip isAuthenticated={false} hasPoems />);
    expect(
      screen.getByText(/tap any poem to reveal the full verse/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/saved to this browser only/i)).toBeInTheDocument();
  });
});
