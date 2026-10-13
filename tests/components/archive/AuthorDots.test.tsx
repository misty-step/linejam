// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthorDots } from '@/components/archive/AuthorDots';

describe('AuthorDots component', () => {
  const mockAuthorIds = ['author1', 'author2', 'author3'];

  describe('rendering', () => {
    it('renders with accessible role and label', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} />);
      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', '3 contributors');
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
  });

  describe('overflow handling', () => {
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
});
