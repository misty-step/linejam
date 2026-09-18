// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PoemSilhouette,
  PoemSilhouetteCompact,
} from '@/components/archive/PoemSilhouette';

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

    it('renders correct number of bars for lines', () => {
      render(<PoemSilhouette wordCounts={standardWordCounts} />);
      const container = screen.getByRole('img');
      // Each word count creates a bar (div)
      expect(container.children).toHaveLength(9);
    });

    it('renders with custom word counts', () => {
      const customCounts = [1, 2, 3];
      render(<PoemSilhouette wordCounts={customCounts} />);
      const silhouette = screen.getByRole('img');
      expect(silhouette).toHaveAttribute(
        'aria-label',
        'Poem silhouette: 1-2-3 words per line'
      );
      expect(silhouette.children).toHaveLength(3);
    });

    it('handles empty word counts array', () => {
      render(<PoemSilhouette wordCounts={[]} />);
      const silhouette = screen.getByRole('img');
      expect(silhouette.children).toHaveLength(0);
    });
  });

  describe('bar width calculation', () => {
    it('calculates proportional widths', () => {
      render(<PoemSilhouette wordCounts={[2, 4]} size="sm" />);
      const silhouette = screen.getByRole('img');
      const bar1 = silhouette.children[0];
      const bar2 = silhouette.children[1];
      if (!(bar1 instanceof HTMLElement) || !(bar2 instanceof HTMLElement)) {
        throw new Error('Expected HTMLElement children');
      }
      // Component normalizes to at least 5, so maxCount = max(2, 4, 5) = 5
      // Bar1: 2/5 * 20 = 8px, Bar2: 4/5 * 20 = 16px
      expect(bar1.style.width).toBe('8px');
      expect(bar2.style.width).toBe('16px');
    });
  });
});

describe('PoemSilhouetteCompact component', () => {
  const wordCounts = [1, 2, 3, 4, 5, 4, 3, 2, 1];

  it('renders with accessible role and label', () => {
    render(<PoemSilhouetteCompact wordCounts={wordCounts} />);
    const silhouette = screen.getByRole('img', { name: /poem silhouette/i });
    expect(silhouette).toBeInTheDocument();
  });

  it('renders correct number of bars', () => {
    render(<PoemSilhouetteCompact wordCounts={wordCounts} />);
    const silhouette = screen.getByRole('img');
    expect(silhouette.children).toHaveLength(9);
  });
});
