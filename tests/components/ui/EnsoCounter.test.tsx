import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { EnsoCounter } from '@/components/ui/EnsoCounter';

describe('EnsoCounter component', () => {
  it('displays current and target counts', () => {
    // Arrange & Act
    render(<EnsoCounter current={3} target={5} />);

    // Assert
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/ 5')).toBeInTheDocument();
  });

  it('shows success color when current equals target', () => {
    // Arrange & Act
    render(<EnsoCounter current={5} target={5} />);

    // Assert - Success state text has success color class
    const currentCount = screen.getByText('5');
    expect(currentCount).toHaveClass('text-[var(--color-success)]');
  });

  it('shows error color when current exceeds target', () => {
    // Arrange & Act
    render(<EnsoCounter current={7} target={5} />);

    // Assert - Over state text has error color class
    const currentCount = screen.getByText('7');
    expect(currentCount).toHaveClass('text-[var(--color-error)]');
  });

  it('shows muted color when current is less than target', () => {
    // Arrange & Act
    render(<EnsoCounter current={2} target={5} />);

    // Assert - Under state text has muted color class
    const currentCount = screen.getByText('2');
    expect(currentCount).toHaveClass('text-[var(--color-text-secondary)]');
  });

  it('handles zero target gracefully', () => {
    // Arrange & Act
    render(<EnsoCounter current={0} target={0} />);

    // Assert - Shows 0/0 without errors
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('/ 0')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    // Arrange & Act
    const { container } = render(
      <EnsoCounter current={1} target={2} className="custom-class" />
    );

    // Assert
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders SVG progress circle', () => {
    // Arrange & Act
    const { container } = render(<EnsoCounter current={3} target={6} />);

    // Assert - SVG exists with circles
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2); // Background and progress circles
  });
});
