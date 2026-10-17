// @vitest-environment happy-dom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HelpModal, HelpContent } from '@/components/HelpModal';

describe('entry island React boundary (rendering is tested in a real browser)', () => {
  it('does not mount a closed help view', () => {
    const { container } = render(
      <HelpModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.querySelector('linejam-entry')).toBeNull();
  });

  it('forwards closure to the current callback without remounting the Rust view', () => {
    const before = vi.fn();
    const after = vi.fn();
    const { container, rerender, unmount } = render(
      <HelpModal isOpen onClose={before} />
    );
    const element = container.querySelector('linejam-entry')!;
    expect(element).toHaveAttribute('view', 'help');
    fireEvent(element, new Event('entry-close', { bubbles: true }));
    expect(before).toHaveBeenCalledTimes(1);
    rerender(<HelpModal isOpen onClose={after} />);
    expect(container.querySelector('linejam-entry')).toBe(element);
    fireEvent(element, new Event('entry-close', { bubbles: true }));
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent(element, new Event('entry-close', { bubbles: true }));
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('delegates embedded content without creating another modal lifecycle', () => {
    const close = vi.fn();
    const { container } = render(<HelpContent onClose={close} />);
    const element = container.querySelector('linejam-entry')!;
    expect(element).toHaveAttribute('view', 'help-content');
    fireEvent(element, new Event('entry-close', { bubbles: true }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
