// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { StageShell } from '@/components/stage/StageShell';

function renderStage(onExit = vi.fn()) {
  const trigger = document.createElement('button');
  trigger.textContent = 'Present room';
  document.body.append(trigger);
  trigger.focus();

  const view = render(
    <StageShell testId="stage" title="Join the room" onExit={onExit}>
      <button type="button">Copy code</button>
    </StageShell>
  );

  return { ...view, onExit, trigger };
}

describe('StageShell', () => {
  it('takes focus to the exit control and hands it back on close', () => {
    const { unmount, trigger } = renderStage();

    expect(
      screen.getByRole('button', { name: 'Exit presentation' })
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    trigger.remove();
  });

  it('leaves the shared display with Escape or the exit control', async () => {
    const user = userEvent.setup();
    const { onExit, trigger } = renderStage();

    await user.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Exit presentation' }));
    expect(onExit).toHaveBeenCalledTimes(2);
    trigger.remove();
  });

  it('keeps tabbing inside the display in both directions', async () => {
    const user = userEvent.setup();
    const { trigger } = renderStage();
    const exit = screen.getByRole('button', { name: 'Exit presentation' });
    const inner = screen.getByRole('button', { name: 'Copy code' });

    await user.tab();
    expect(inner).toHaveFocus();

    await user.tab();
    expect(exit).toHaveFocus();

    await user.tab({ shift: true });
    expect(inner).toHaveFocus();
    trigger.remove();
  });
});
