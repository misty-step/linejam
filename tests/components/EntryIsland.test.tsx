// @vitest-environment happy-dom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HelpModal, HelpContent } from '@/components/HelpModal';
import { EntryIsland, type EntrySubmission } from '@/components/EntryIsland';

describe('entry island React boundary (rendering is tested in a real browser)', () => {
  it('settles admission with only the typed form fields, not the callback envelope', async () => {
    const input: EntrySubmission = {
      code: 'ABCD',
      displayName: 'Ada',
      avatarId: 'quill',
    };
    const onSubmit = vi.fn(async () => 'Room is full');
    const { container } = render(
      <EntryIsland kind="join" ready onSubmit={onSubmit} />
    );
    const result = Promise.withResolvers<string>();
    const event = new CustomEvent('entry-submit', {
      bubbles: true,
      cancelable: true,
      detail: { ...input, resolve: result.resolve, reject: result.reject },
    });
    fireEvent(container.querySelector('linejam-entry')!, event);
    expect(event.defaultPrevented).toBe(true);
    await expect(result.promise).resolves.toBe('Room is full');
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(input);
  });

  it.each(['synchronous', 'asynchronous'])(
    'settles an unexpected %s boundary failure instead of leaving WASM pending',
    async (kind) => {
      const cause = new Error('reporter unavailable');
      const onSubmit = () => {
        if (kind === 'synchronous') throw cause;
        return Promise.reject(cause);
      };
      const { container } = render(
        <EntryIsland kind="join" ready onSubmit={onSubmit} />
      );
      const result = Promise.withResolvers<string>();
      fireEvent(
        container.querySelector('linejam-entry')!,
        new CustomEvent('entry-submit', {
          bubbles: true,
          cancelable: true,
          detail: {
            code: 'ABCD',
            displayName: 'Ada',
            avatarId: 'quill',
            resolve: result.resolve,
            reject: result.reject,
          },
        })
      );
      await expect(result.promise).rejects.toBe(cause);
    }
  );

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
