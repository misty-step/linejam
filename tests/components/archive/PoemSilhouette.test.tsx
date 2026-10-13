// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoemSilhouette } from '@/components/archive/PoemSilhouette';

describe('PoemSilhouette component', () => {
  const standardWordCounts = [1, 2, 3, 4, 5, 4, 3, 2, 1];

  describe('rendering', () => {
    it('renders with accessible role and label', () => {
      render(<PoemSilhouette wordCounts={standardWordCounts} />);
      const silhouette = screen.getByRole('img', { name: /poem silhouette/i });
      expect(silhouette).toBeInTheDocument();
      expect(silhouette).toHaveAttribute(
        'aria-label',
        'Poem silhouette: 1-2-3-4-5-4-3-2-1 words per line'
      );
    });
  });
});
