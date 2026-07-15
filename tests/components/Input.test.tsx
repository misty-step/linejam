// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('can shrink inside narrow and text-scaled form containers', () => {
    render(<Input aria-label="Pen name" />);

    expect(screen.getByRole('textbox', { name: 'Pen name' })).toHaveClass(
      'min-w-0',
      'max-w-full'
    );
  });
});
