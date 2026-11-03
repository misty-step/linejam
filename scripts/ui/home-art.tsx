// Build input only: reuse the canonical renderer, never a second editable cast.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../../components/ui/Avatar';
import { AVATAR_IDS, AVATAR_NAMES } from '../../lib/avatars';

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
writeFileSync(
  '.ui-build/entry-avatars.rs',
  `pub const AVATARS: [(&str, &str, &str); ${AVATAR_IDS.length}] = [\n${AVATAR_IDS.map(
    (avatarId) =>
      `(${JSON.stringify(avatarId)}, ${JSON.stringify(AVATAR_NAMES[avatarId])}, r###"${renderToStaticMarkup(
        createElement(Avatar, {
          stableId: avatarId,
          displayName: AVATAR_NAMES[avatarId],
          avatarId,
          size: 'md',
        })
      )}"###),`
  ).join('\n')}\n];\n`
);
