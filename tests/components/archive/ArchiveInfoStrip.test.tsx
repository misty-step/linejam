// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArchiveInfoStrip } from '@/components/archive/ArchiveInfoStrip';

describe('ArchiveInfoStrip', () => {
  it('does not offer registration to a signed-in participant', () => {
    const { container } = render(
      <ArchiveInfoStrip isAuthenticated accountsAvailable />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('gives guests a registration path without blocking the archive', () => {
    render(<ArchiveInfoStrip isAuthenticated={false} accountsAvailable />);
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
  });

  it('does not send local guests to an unavailable account provider', () => {
    render(
      <ArchiveInfoStrip isAuthenticated={false} accountsAvailable={false} />
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
