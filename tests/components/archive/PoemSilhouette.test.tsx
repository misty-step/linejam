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

  describe('size variants', () => {
    it('applies sm size by default', () => {
      render(<PoemSilhouette wordCounts={standardWordCounts} />);
      const silhouette = screen.getByRole('img');
      // Gap should be 1px for sm
      expect(silhouette).toHaveStyle({ gap: '1px' });
    });

    it('applies md size styles', () => {
      render(<PoemSilhouette wordCounts={standardWordCounts} size="md" />);
      const silhouette = screen.getByRole('img');
      expect(silhouette).toHaveStyle({ gap: '1.5px' });
    });

    it('applies lg size styles', () => {
      render(<PoemSilhouette wordCounts={standardWordCounts} size="lg" />);
      const silhouette = screen.getByRole('img');
      expect(silhouette).toHaveStyle({ gap: '2px' });
    });
  });

  describe('animation', () => {
    it('does not animate by default', () => {
      render(<PoemSilhouette wordCounts={standardWordCounts} />);
      const silhouette = screen.getByRole('img');
      const firstBar = silhouette.children[0];
      expect(firstBar).not.toHaveClass('opacity-0');
    });

    it('applies animation class when animate is true', () => {
      render(<PoemSilhouette wordCounts={standardWordCounts} animate={true} />);
      const silhouette = screen.getByRole('img');
      const firstBar = silhouette.children[0];
      expect(firstBar).toHaveClass('opacity-0');
    });
  });

  describe('custom className', () => {
    it('applies custom className to container', () => {
      render(
        <PoemSilhouette
          wordCounts={standardWordCounts}
          className="custom-class"
        />
      );
      const silhouette = screen.getByRole('img');
      expect(silhouette).toHaveClass('custom-class');
    });
  });

  describe('bar width calculation', () => {
    it('normalizes width to max word count', () => {
      render(<PoemSilhouette wordCounts={[5]} size="sm" />);
      const silhouette = screen.getByRole('img');
      const bar = silhouette.children[0];
      if (!(bar instanceof HTMLElement)) {
        throw new Error('Expected HTMLElement child');
      }
      // Max width for sm is 20px, 5/5 = 100% = 20px
      expect(bar.style.width).toBe('20px');
    });

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

    it('ensures minimum width of 2px', () => {
      render(<PoemSilhouette wordCounts={[0, 5]} size="sm" />);
      const silhouette = screen.getByRole('img');
      const bar = silhouette.children[0];
      if (!(bar instanceof HTMLElement)) {
        throw new Error('Expected HTMLElement child');
      }
      expect(bar.style.minWidth).toBe('2px');
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

  it('renders bars horizontally (flex row)', () => {
    render(<PoemSilhouetteCompact wordCounts={wordCounts} />);
    const silhouette = screen.getByRole('img');
    expect(silhouette).toHaveClass('flex');
    expect(silhouette).toHaveClass('items-end');
  });

  it('applies custom className', () => {
    render(
      <PoemSilhouetteCompact wordCounts={wordCounts} className="my-class" />
    );
    const silhouette = screen.getByRole('img');
    expect(silhouette).toHaveClass('my-class');
  });
});
