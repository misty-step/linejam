// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoemShape, PoemShapeCompact } from '@/components/archive/PoemShape';

describe('PoemShape component', () => {
  const standardWordCounts = [1, 2, 3, 4, 5, 4, 3, 2, 1];

  describe('rendering', () => {
    it('renders with accessible role and label', () => {
      render(<PoemShape wordCounts={standardWordCounts} />);
      const shape = screen.getByRole('img', { name: /poem shape/i });
      expect(shape).toBeInTheDocument();
      expect(shape).toHaveAttribute(
        'aria-label',
        'Poem shape: 1-2-3-4-5-4-3-2-1 words per line'
      );
    });

    it('renders correct number of bars for lines', () => {
      render(<PoemShape wordCounts={standardWordCounts} />);
      const container = screen.getByRole('img');
      // Each word count creates a bar (div)
      expect(container.children).toHaveLength(9);
    });

    it('renders with custom word counts', () => {
      const customCounts = [1, 2, 3];
      render(<PoemShape wordCounts={customCounts} />);
      const shape = screen.getByRole('img');
      expect(shape).toHaveAttribute(
        'aria-label',
        'Poem shape: 1-2-3 words per line'
      );
      expect(shape.children).toHaveLength(3);
    });

    it('handles empty word counts array', () => {
      render(<PoemShape wordCounts={[]} />);
      const shape = screen.getByRole('img');
      expect(shape.children).toHaveLength(0);
    });
  });

  describe('size variants', () => {
    it('applies sm size by default', () => {
      render(<PoemShape wordCounts={standardWordCounts} />);
      const shape = screen.getByRole('img');
      // Gap should be 1px for sm
      expect(shape).toHaveStyle({ gap: '1px' });
    });

    it('applies md size styles', () => {
      render(<PoemShape wordCounts={standardWordCounts} size="md" />);
      const shape = screen.getByRole('img');
      expect(shape).toHaveStyle({ gap: '1.5px' });
    });

    it('applies lg size styles', () => {
      render(<PoemShape wordCounts={standardWordCounts} size="lg" />);
      const shape = screen.getByRole('img');
      expect(shape).toHaveStyle({ gap: '2px' });
    });
  });

  describe('animation', () => {
    it('does not animate by default', () => {
      render(<PoemShape wordCounts={standardWordCounts} />);
      const shape = screen.getByRole('img');
      const firstBar = shape.children[0];
      expect(firstBar).not.toHaveClass('opacity-0');
    });

    it('applies animation class when animate is true', () => {
      render(<PoemShape wordCounts={standardWordCounts} animate={true} />);
      const shape = screen.getByRole('img');
      const firstBar = shape.children[0];
      expect(firstBar).toHaveClass('opacity-0');
    });
  });

  describe('custom className', () => {
    it('applies custom className to container', () => {
      render(
        <PoemShape wordCounts={standardWordCounts} className="custom-class" />
      );
      const shape = screen.getByRole('img');
      expect(shape).toHaveClass('custom-class');
    });
  });

  describe('bar width calculation', () => {
    it('normalizes width to max word count', () => {
      render(<PoemShape wordCounts={[5]} size="sm" />);
      const shape = screen.getByRole('img');
      const bar = shape.children[0] as HTMLElement;
      // Max width for sm is 20px, 5/5 = 100% = 20px
      expect(bar.style.width).toBe('20px');
    });

    it('calculates proportional widths', () => {
      render(<PoemShape wordCounts={[2, 4]} size="sm" />);
      const shape = screen.getByRole('img');
      const bar1 = shape.children[0] as HTMLElement;
      const bar2 = shape.children[1] as HTMLElement;
      // Component normalizes to at least 5, so maxCount = max(2, 4, 5) = 5
      // Bar1: 2/5 * 20 = 8px, Bar2: 4/5 * 20 = 16px
      expect(bar1.style.width).toBe('8px');
      expect(bar2.style.width).toBe('16px');
    });

    it('ensures minimum width of 2px', () => {
      render(<PoemShape wordCounts={[0, 5]} size="sm" />);
      const shape = screen.getByRole('img');
      const bar = shape.children[0] as HTMLElement;
      expect(bar.style.minWidth).toBe('2px');
    });
  });
});

describe('PoemShapeCompact component', () => {
  const wordCounts = [1, 2, 3, 4, 5, 4, 3, 2, 1];

  it('renders with accessible role and label', () => {
    render(<PoemShapeCompact wordCounts={wordCounts} />);
    const shape = screen.getByRole('img', { name: /poem shape/i });
    expect(shape).toBeInTheDocument();
  });

  it('renders correct number of bars', () => {
    render(<PoemShapeCompact wordCounts={wordCounts} />);
    const shape = screen.getByRole('img');
    expect(shape.children).toHaveLength(9);
  });

  it('renders bars horizontally (flex row)', () => {
    render(<PoemShapeCompact wordCounts={wordCounts} />);
    const shape = screen.getByRole('img');
    expect(shape).toHaveClass('flex');
    expect(shape).toHaveClass('items-end');
  });

  it('applies custom className', () => {
    render(<PoemShapeCompact wordCounts={wordCounts} className="my-class" />);
    const shape = screen.getByRole('img');
    expect(shape).toHaveClass('my-class');
  });
});
