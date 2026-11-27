// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyArchive } from '@/components/archive/EmptyArchive';

describe('EmptyArchive component', () => {
  describe('default variant', () => {
    it('renders the New room link to /host', () => {
      render(<EmptyArchive />);
      const startLink = screen.getByRole('link', { name: /^new room$/i });
      expect(startLink).toBeInTheDocument();
      expect(startLink).toHaveAttribute('href', '/host');
    });

    it('renders the Join link to /join', () => {
      render(<EmptyArchive />);
      const joinLink = screen.getByRole('link', { name: /^join$/i });
      expect(joinLink).toBeInTheDocument();
      expect(joinLink).toHaveAttribute('href', '/join');
    });
  });

  describe('filtered variant', () => {
    it('does not render CTA buttons in filtered variant', () => {
      render(<EmptyArchive variant="filtered" />);
      expect(
        screen.queryByRole('link', { name: /^new room$/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /^join$/i })
      ).not.toBeInTheDocument();
    });
  });
});
