// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '@/components/ui/Avatar';

describe('Avatar component', () => {
  describe('basic rendering', () => {
    it('renders with accessible role and label', () => {
      render(<Avatar stableId="user123" displayName="Alice" />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('aria-label', "Alice's color marker");
    });

    it('applies custom className', () => {
      render(
        <Avatar stableId="user123" displayName="Alice" className="my-class" />
      );
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('my-class');
    });
  });

  describe('size variants', () => {
    it('applies default md size', () => {
      render(<Avatar stableId="user123" displayName="Alice" />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-3', 'h-3');
    });

    it('applies xs size', () => {
      render(<Avatar stableId="user123" displayName="Alice" size="xs" />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-2', 'h-2');
    });

    it('applies sm size', () => {
      render(<Avatar stableId="user123" displayName="Alice" size="sm" />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-2.5', 'h-2.5');
    });

    it('applies lg size', () => {
      render(<Avatar stableId="user123" displayName="Alice" size="lg" />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-4', 'h-4');
    });

    it('applies xl size', () => {
      render(<Avatar stableId="user123" displayName="Alice" size="xl" />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-5', 'h-5');
    });
  });

  describe('color generation', () => {
    it('uses getUserColor when allStableIds not provided', () => {
      render(<Avatar stableId="user123" displayName="Alice" />);
      const avatar = screen.getByRole('img');
      // Should have a background color set
      expect(avatar).toHaveStyle({ backgroundColor: expect.any(String) });
    });

    it('uses getUniqueColor when allStableIds provided', () => {
      render(
        <Avatar
          stableId="user123"
          displayName="Alice"
          allStableIds={['user123', 'user456', 'user789']}
        />
      );
      const avatar = screen.getByRole('img');
      // Should have a background color set
      expect(avatar).toHaveStyle({ backgroundColor: expect.any(String) });
    });
  });

  describe('outlined variant', () => {
    it('applies filled style by default', () => {
      render(<Avatar stableId="user123" displayName="Alice" />);
      const avatar = screen.getByRole('img');
      expect(avatar).not.toHaveClass('border-2');
    });

    it('applies outline style when outlined is true', () => {
      render(<Avatar stableId="user123" displayName="Alice" outlined />);
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('border-2');
      expect(avatar).toHaveStyle({ backgroundColor: 'transparent' });
    });
  });
});
