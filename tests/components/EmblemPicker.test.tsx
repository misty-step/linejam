// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmblemPicker } from '@/components/EmblemPicker';
import type { AvatarId } from '@/lib/avatars';

function Harness() {
  const [value, setValue] = useState<AvatarId>('haiku');
  return <EmblemPicker value={value} onChange={setValue} />;
}

describe('EmblemPicker', () => {
  it('offers the eight named emblems as one radio group', () => {
    render(<EmblemPicker value="haiku" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Emblem' });
    const radios = screen.getAllByRole('radio');
    expect(group).toBeInTheDocument();
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'Loom',
      'Vesper',
      'Prism',
      'Clover',
      'Orrery',
      'Arch',
      'Pinwheel',
      'Lattice',
    ]);
    expect(screen.getByRole('radio', { name: 'Vesper' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('selects by click and by arrow keys', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Orrery' }));
    expect(screen.getByRole('radio', { name: 'Orrery' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await user.keyboard('{ArrowRight}');
    const arch = screen.getByRole('radio', { name: 'Arch' });
    expect(arch).toHaveAttribute('aria-checked', 'true');
    expect(arch).toHaveFocus();
  });

  it('cannot change while disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<EmblemPicker value="haiku" onChange={onChange} disabled />);
    await user.click(screen.getByRole('radio', { name: 'Loom' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
