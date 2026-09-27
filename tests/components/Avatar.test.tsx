// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar } from '@/components/ui/Avatar';
import type { AvatarId } from '@/lib/avatars';

function drawing(avatarId: AvatarId | undefined, stableId = 'guest-1') {
  const { container } = render(
    <Avatar stableId={stableId} displayName="Ada" avatarId={avatarId} />
  );
  return container.innerHTML;
}

describe('Avatar', () => {
  it('draws the stable default when a newer server sends an unknown id', () => {
    // SAFETY: Deliberately bypass the client type to model version skew during a deploy.
    const unknown = 'lantern' as AvatarId;
    expect(drawing(unknown, 'guest-1')).toBe(drawing(undefined, 'guest-1'));
  });
});
