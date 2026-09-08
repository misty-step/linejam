// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AvatarPicker } from '@/components/AvatarPicker';
import { AVATAR_IDS, AVATAR_NAMES } from '@/lib/avatars';

describe('AvatarPicker', () => {
  it('offers the whole cast with the current choice selected', () => {
    render(<AvatarPicker value="moss" onChange={vi.fn()} />);

    const group = screen.getByRole('radiogroup', {
      name: 'Choose your avatar',
    });
    expect(screen.getAllByRole('radio')).toHaveLength(AVATAR_IDS.length);
    expect(
      screen.getByRole('radio', { name: AVATAR_NAMES.moss })
    ).toBeChecked();
    expect(group).toBeInTheDocument();
  });

  it('reports the chosen character to its owner', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AvatarPicker value="moss" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: AVATAR_NAMES.sunny }));

    expect(onChange).toHaveBeenCalledWith('sunny');
  });

  it('reaches the neighbouring character with the keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AvatarPicker value={AVATAR_IDS[0]} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: AVATAR_NAMES.pip }));
    onChange.mockClear();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith(AVATAR_IDS[1]);
  });

  it('cannot be changed while the form is submitting', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AvatarPicker value="moss" onChange={onChange} disabled />);

    await user.click(screen.getByRole('radio', { name: AVATAR_NAMES.sunny }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
