// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthorDots, AuthorDotsInline } from '@/components/archive/AuthorDots';

describe('AuthorDots component', () => {
  const mockAuthorIds = ['author1', 'author2', 'author3'];

  describe('rendering', () => {
    it('renders with accessible role and label', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} />);
      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', '3 contributors');
    });

    it('renders singular label for one contributor', () => {
      render(<AuthorDots authorStableIds={['author1']} />);
      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', '1 contributor');
    });

    it('renders correct number of dots for authors', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} />);
      const group = screen.getByRole('group');
      // 3 dots, no overflow
      expect(group.querySelectorAll('div[title]')).toHaveLength(3);
    });

    it('deduplicates author IDs', () => {
      render(
        <AuthorDots authorStableIds={['author1', 'author1', 'author2']} />
      );
      const group = screen.getByRole('group');
      // Only 2 unique authors
      expect(group.querySelectorAll('div[title]')).toHaveLength(2);
      expect(group).toHaveAttribute('aria-label', '2 contributors');
    });

    it('handles empty array', () => {
      render(<AuthorDots authorStableIds={[]} />);
      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', '0 contributors');
    });
  });

  describe('overflow handling', () => {
    it('shows all dots when under maxVisible', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} maxVisible={5} />);
      const group = screen.getByRole('group');
      expect(group.querySelectorAll('div[title]')).toHaveLength(3);
      expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
    });

    it('truncates and shows overflow count when exceeding maxVisible', () => {
      const manyAuthors = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
      render(<AuthorDots authorStableIds={manyAuthors} maxVisible={5} />);
      const group = screen.getByRole('group');
      // Only 5 visible
      expect(group.querySelectorAll('div[title]')).toHaveLength(5);
      // +2 overflow
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('dot styling', () => {
    it('renders dots with title attributes', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} />);
      expect(screen.getByTitle('Contributor 1')).toBeInTheDocument();
      expect(screen.getByTitle('Contributor 2')).toBeInTheDocument();
      expect(screen.getByTitle('Contributor 3')).toBeInTheDocument();
    });
  });
});

describe('AuthorDotsInline component', () => {
  describe('rendering', () => {
    it('returns null for empty array', () => {
      const { container } = render(<AuthorDotsInline authorStableIds={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders with accessible label for single author', () => {
      render(<AuthorDotsInline authorStableIds={['author1']} />);
      expect(screen.getByLabelText('1 contributor')).toBeInTheDocument();
    });

    it('renders with accessible label for multiple authors', () => {
      render(<AuthorDotsInline authorStableIds={['a1', 'a2', 'a3']} />);
      expect(screen.getByLabelText('3 contributors')).toBeInTheDocument();
    });

    it('deduplicates author IDs', () => {
      render(
        <AuthorDotsInline authorStableIds={['author1', 'author1', 'author2']} />
      );
      expect(screen.getByLabelText('2 contributors')).toBeInTheDocument();
    });
  });
});
