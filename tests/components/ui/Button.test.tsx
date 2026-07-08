// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('uses the resolved primary token class instead of Tailwind color utilities', () => {
    render(<Button>Submit</Button>);

    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toHaveClass('lj-button-primary');
    expect(button.className).not.toContain('bg-primary');
  });
});
