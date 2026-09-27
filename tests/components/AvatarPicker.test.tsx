// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AvatarPicker } from '@/components/AvatarPicker';
import { AVATAR_IDS, AVATAR_NAMES, type AvatarId } from '@/lib/avatars';

function ControlledPicker() {
  const [value, setValue] = useState<AvatarId>('rhyme');
  return <AvatarPicker value={value} onChange={setValue} />;
}

describe('AvatarPicker', () => {
  it('keeps the cast hidden until opened, then focuses the selected character', async () => {
    const user = userEvent.setup();
    render(<AvatarPicker value="haiku" onChange={vi.fn()} />);
    const trigger = screen.getByRole('button', {
      name: /change avatar.*haiku.*selected/i,
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);

    const cast = screen.getByRole('group', { name: /choose your avatar/i });
    for (const id of AVATAR_IDS) {
      expect(
        within(cast).getByRole('button', { name: AVATAR_NAMES[id] })
      ).toHaveAttribute('aria-pressed', String(id === 'haiku'));
    }
    expect(screen.getByRole('button', { name: 'Haiku' })).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('applies a tapped character immediately and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);
    const trigger = screen.getByRole('button', { name: /change avatar/i });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Doodle' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAccessibleName(/doodle.*selected/i);
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Doodle' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Doodle' })).toHaveFocus();
  });

  it('keeps Tab in the picker and lets Space choose a focused character', async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);
    const trigger = screen.getByRole('button', { name: /change avatar/i });
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Rhyme' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(
      screen.getByRole('button', { name: /close avatar picker/i })
    ).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Ode' })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('button', { name: /close avatar picker/i })
    ).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Haiku' })).toHaveFocus();
    await user.keyboard(' ');

    expect(trigger).toHaveAccessibleName(/haiku.*selected/i);
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismisses with Escape, the close button, or an outside pointer without changing the choice', async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);
    const trigger = screen.getByRole('button', { name: /change avatar/i });

    await user.click(trigger);
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(
      screen.getByRole('button', { name: /close avatar picker/i })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAccessibleName(/rhyme.*selected/i);
  });

  it('disables both the trigger and any open choices during submission', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <AvatarPicker value="haiku" onChange={onChange} disabled />
    );
    const trigger = screen.getByRole('button', { name: /change avatar/i });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    view.rerender(<AvatarPicker value="haiku" onChange={onChange} />);
    await user.click(trigger);
    view.rerender(<AvatarPicker value="haiku" onChange={onChange} disabled />);
    const cast = screen.getByRole('group', { name: /choose your avatar/i });
    for (const choice of within(cast).getAllByRole('button')) {
      expect(choice).toBeDisabled();
    }
    await user.click(screen.getByRole('button', { name: 'Doodle' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveAccessibleName(/haiku.*selected/i);
    await user.click(
      screen.getByRole('button', { name: /close avatar picker/i })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
