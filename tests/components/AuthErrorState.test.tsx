// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthErrorState } from '@/components/AuthErrorState';

describe('AuthErrorState component', () => {
  it('omits the title when an empty string is provided and still retries', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthErrorState
        message="Unable to reach the room."
        onRetry={onRetry}
        title=""
        retryLabel="Reconnect"
      />
    );

    expect(screen.queryByText('Connection error')).not.toBeInTheDocument();
    expect(screen.getByText('Unable to reach the room.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
