// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordSlots } from '@/components/ui/WordSlots';

describe('WordSlots component', () => {
  describe('basic rendering', () => {
    it('renders with accessible role and label', () => {
      render(<WordSlots current={2} target={5} />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', '2 of 5 words');
    });

    it('renders words label', () => {
      render(<WordSlots current={0} target={3} />);
      expect(screen.getByText('words')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<WordSlots current={1} target={2} className="my-custom-class" />);
      const status = screen.getByRole('status');
      expect(status).toHaveClass('my-custom-class');
    });
  });

  describe('slot states', () => {
    it('renders target number of base slots', () => {
      const { container } = render(<WordSlots current={0} target={5} />);
      // 5 target slots (not counting "words" label)
      const slots = container.querySelectorAll('#word-slots > div');
      expect(slots).toHaveLength(5);
    });

    it('fills slots up to current count', () => {
      const { container } = render(<WordSlots current={3} target={5} />);
      const filledSlots = container.querySelectorAll(
        '.bg-\\[var\\(--color-foreground\\)\\]'
      );
      expect(filledSlots).toHaveLength(3);
    });

    it('applies primary color when at target', () => {
      const { container } = render(<WordSlots current={5} target={5} />);
      const primarySlots = container.querySelectorAll(
        '.bg-\\[var\\(--color-primary\\)\\]'
      );
      expect(primarySlots).toHaveLength(5);
    });
  });

  describe('overflow handling', () => {
    it('shows dashed overflow slots when over target', () => {
      const { container } = render(<WordSlots current={7} target={5} />);
      const overflowSlots = container.querySelectorAll('.border-dashed');
      // 2 overflow slots (7 - 5 = 2)
      expect(overflowSlots).toHaveLength(2);
    });

    it('caps overflow slots at 10', () => {
      const { container } = render(<WordSlots current={20} target={5} />);
      const overflowSlots = container.querySelectorAll('.border-dashed');
      // Capped at 10 overflow slots
      expect(overflowSlots).toHaveLength(10);
    });

    it('shows +N indicator when overflow exceeds cap', () => {
      render(<WordSlots current={18} target={5} />);
      // 18 - 5 = 13 overflow, capped at 10, so +3 extra
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('does not show +N indicator when overflow is within cap', () => {
      render(<WordSlots current={12} target={5} />);
      // 12 - 5 = 7 overflow, within 10 cap
      expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
    });
  });

  describe('growing word chips (text supplied)', () => {
    it('renders each typed word as a chip and pads remaining target slots empty', () => {
      const { container } = render(
        <WordSlots current={2} target={5} text="brave new" />
      );

      expect(screen.getByText('brave')).toBeInTheDocument();
      expect(screen.getByText('new')).toBeInTheDocument();

      // 5 target slots total: 2 word chips + 3 empty squares
      const slots = container.querySelectorAll('#word-slots > [data-slot]');
      expect(slots).toHaveLength(5);
      expect(container.querySelectorAll('[data-slot="filled"]')).toHaveLength(
        2
      );
      expect(container.querySelectorAll('[data-slot="empty"]')).toHaveLength(3);
    });

    it('derives the aria-label word count from the text, not the current prop', () => {
      render(<WordSlots current={0} target={5} text="brave new" />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', '2 of 5 words');
    });

    it('renders a long word fully, unclipped, with no fixed-width style', () => {
      render(<WordSlots current={1} target={1} text="extraordinarily" />);

      const chip = screen.getByText('extraordinarily');
      // The exact word, not truncated with an ellipsis or cut off.
      expect(chip).toHaveTextContent('extraordinarily');
      // Sized to content — no fixed-width utility class or inline width style.
      expect(chip.className).not.toMatch(/(^|\s)w-\d/);
      expect(chip.style.width).toBe('');
      expect(chip.className).not.toContain('truncate');
      expect(chip.className).not.toContain('overflow-hidden');
    });

    it('colors filled chips primary once the word count reaches target', () => {
      render(<WordSlots current={2} target={2} text="right there" />);

      const chip = screen.getByText('right');
      expect(chip.className).toContain('bg-[var(--color-primary)]');
    });

    it('renders overflow words as error-styled chips showing the actual word', () => {
      render(
        <WordSlots
          current={7}
          target={5}
          text="one two three four five six seven"
        />
      );

      const overflowChip = screen.getByText('six');
      expect(overflowChip.className).toContain('border-[var(--color-error)]');
      expect(screen.getByText('seven')).toBeInTheDocument();
    });

    it('caps displayed overflow chips and shows a +N indicator beyond the cap', () => {
      // 18 total words: 5 fill the target, 13 overflow.
      const allWords = Array.from({ length: 18 }, (_, i) => `w${i}`).join(' ');
      render(<WordSlots current={18} target={5} text={allWords} />);

      // 13 overflow, capped at 10 displayed chips, so +3 extra
      expect(
        screen
          .getByTestId('writing-word-slots')
          .querySelectorAll('[data-slot="overflow"]')
      ).toHaveLength(10);
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('falls back to legacy square rendering when text is omitted', () => {
      const { container } = render(<WordSlots current={2} target={5} />);

      // No word text is rendered, only empty/filled squares.
      const slots = container.querySelectorAll('#word-slots > div');
      expect(slots).toHaveLength(5);
    });
  });
});
