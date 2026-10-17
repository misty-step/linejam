// Build input only: reuse the canonical renderer, never a second editable cast.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../../components/ui/Avatar';
import { AVATAR_NAMES } from '../../lib/avatars';

mkdirSync('.ui-build', { recursive: true });
writeFileSync(
  '.ui-build/home-avatars.html',
  (['rhyme', 'haiku', 'doodle', 'ode'] as const)
    .map((avatarId) =>
      renderToStaticMarkup(
        createElement(Avatar, {
          stableId: `home-${avatarId}`,
          displayName: AVATAR_NAMES[avatarId],
          avatarId,
          size: 'lg',
        })
      )
    )
    .join('')
);
