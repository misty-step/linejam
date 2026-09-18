// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyArchive } from '@/components/archive/EmptyArchive';

describe('EmptyArchive component', () => {
  describe('default variant', () => {
    it('renders Start a Game button with correct link', () => {
      render(<EmptyArchive />);
      const startLink = screen.getByRole('link', { name: /start a game/i });
      expect(startLink).toBeInTheDocument();
      expect(startLink).toHaveAttribute('href', '/host');
    });

    it('renders Join a Room button with correct link', () => {
      render(<EmptyArchive />);
      const joinLink = screen.getByRole('link', { name: /join a room/i });
      expect(joinLink).toBeInTheDocument();
      expect(joinLink).toHaveAttribute('href', '/join');
    });
  });

  describe('filtered variant', () => {
    it('does not render CTA buttons in filtered variant', () => {
      render(<EmptyArchive variant="filtered" />);
      expect(
        screen.queryByRole('link', { name: /start a game/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /join a room/i })
      ).not.toBeInTheDocument();
    });
  });
});
