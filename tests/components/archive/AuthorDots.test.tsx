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

  describe('size variants', () => {
    it('applies sm size by default', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} />);
      const group = screen.getByRole('group');
      expect(group).toHaveStyle({ gap: '2px' });
    });

    it('applies md size styles', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} size="md" />);
      const group = screen.getByRole('group');
      expect(group).toHaveStyle({ gap: '3px' });
    });

    it('applies lg size styles', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} size="lg" />);
      const group = screen.getByRole('group');
      expect(group).toHaveStyle({ gap: '4px' });
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

    it('uses default maxVisible of 5', () => {
      const manyAuthors = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
      render(<AuthorDots authorStableIds={manyAuthors} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  describe('dot styling', () => {
    it('renders dots with title attributes', () => {
      render(<AuthorDots authorStableIds={mockAuthorIds} />);
      expect(screen.getByTitle('Contributor 1')).toBeInTheDocument();
      expect(screen.getByTitle('Contributor 2')).toBeInTheDocument();
      expect(screen.getByTitle('Contributor 3')).toBeInTheDocument();
    });

    it('applies hover scale class to dots', () => {
      render(<AuthorDots authorStableIds={['author1']} />);
      const dot = screen.getByTitle('Contributor 1');
      expect(dot).toHaveClass('hover:scale-125');
    });
  });

  describe('custom className', () => {
    it('applies custom className to container', () => {
      render(
        <AuthorDots authorStableIds={mockAuthorIds} className="custom-class" />
      );
      const group = screen.getByRole('group');
      expect(group).toHaveClass('custom-class');
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
      expect(screen.getByLabelText('1 contributors')).toBeInTheDocument();
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

  describe('gradient styling', () => {
    it('uses solid color for single author', () => {
      render(<AuthorDotsInline authorStableIds={['author1']} />);
      const bar = screen.getByLabelText('1 contributors');
      // Single color - no gradient (solid background)
      expect(bar.style.background).not.toContain('gradient');
    });

    it('uses gradient for multiple authors', () => {
      render(<AuthorDotsInline authorStableIds={['a1', 'a2']} />);
      const bar = screen.getByLabelText('2 contributors');
      expect(bar.style.background).toContain('linear-gradient');
    });
  });

  describe('width scaling', () => {
    it('scales width based on number of authors', () => {
      render(<AuthorDotsInline authorStableIds={['a1']} />);
      const bar1 = screen.getByLabelText('1 contributors');
      expect(bar1.style.width).toBe('12px'); // 1 * 12

      const { rerender } = render(
        <AuthorDotsInline authorStableIds={['a1', 'a2', 'a3']} />
      );
      rerender(<AuthorDotsInline authorStableIds={['a1', 'a2', 'a3']} />);
      const bar3 = screen.getByLabelText('3 contributors');
      expect(bar3.style.width).toBe('36px'); // 3 * 12
    });

    it('caps width at 48px', () => {
      render(
        <AuthorDotsInline authorStableIds={['a1', 'a2', 'a3', 'a4', 'a5']} />
      );
      const bar = screen.getByLabelText('5 contributors');
      expect(bar.style.width).toBe('48px'); // capped at 48
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      render(
        <AuthorDotsInline
          authorStableIds={['author1']}
          className="my-custom-class"
        />
      );
      const bar = screen.getByLabelText('1 contributors');
      expect(bar).toHaveClass('my-custom-class');
    });
  });
});
