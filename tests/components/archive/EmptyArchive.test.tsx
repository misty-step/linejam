// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyArchive } from '@/components/archive/EmptyArchive';

describe('EmptyArchive component', () => {
  describe('default variant', () => {
    it('renders the main heading', () => {
      render(<EmptyArchive />);
      expect(
        screen.getByRole('heading', { name: /your archive awaits/i })
      ).toBeInTheDocument();
    });

    it('renders the description text', () => {
      render(<EmptyArchive />);
      expect(
        screen.getByText(/every poem you help create will appear here/i)
      ).toBeInTheDocument();
    });

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

    it('renders decorative poem shape', () => {
      render(<EmptyArchive />);
      // PoemShape has role="img" with aria-label
      expect(
        screen.getByRole('img', { name: /poem shape/i })
      ).toBeInTheDocument();
    });

    it('renders the decorative footer text', () => {
      render(<EmptyArchive />);
      expect(screen.getByText(/begin your collection/i)).toBeInTheDocument();
    });
  });

  describe('filtered variant', () => {
    it('renders no matches message', () => {
      render(<EmptyArchive variant="filtered" />);
      expect(
        screen.getByText(/no poems match your search/i)
      ).toBeInTheDocument();
    });

    it('renders filter adjustment suggestion', () => {
      render(<EmptyArchive variant="filtered" />);
      expect(
        screen.getByText(/try adjusting your filters/i)
      ).toBeInTheDocument();
    });

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
