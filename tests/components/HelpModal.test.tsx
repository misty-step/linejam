// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpModal } from '@/components/HelpModal';

describe('HelpModal component', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does not render when closed', () => {
    render(<HelpModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('locks body scroll when opened and restores it when closed', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<HelpModal isOpen onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /Close help/i });

    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<HelpModal isOpen={false} onClose={onClose} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes from escape, the overlay, and either action button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<HelpModal isOpen onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    const overlay = dialog.parentElement;

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    expect(overlay).not.toBeNull();
    await user.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: /Close help/i }));
    expect(onClose).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('traps focus within the modal when tabbing', async () => {
    render(<HelpModal isOpen onClose={vi.fn()} />);

    const closeButton = screen.getByRole('button', { name: /Close help/i });
    const confirmButton = screen.getByRole('button', { name: /Got it/i });

    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    confirmButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();
  });
});
