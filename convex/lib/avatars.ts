import { v } from 'convex/values';
import { STORED_AVATAR_IDS } from '../../lib/avatars';

/**
 * Expanded to accept retired first-cast ids until `migrations.migrateAvatarIds` has run in
 * production. Contract it to AVATAR_IDS in a later release (docs/convex-migrations.md).
 */
export const avatarIdValidator = v.union(
  ...STORED_AVATAR_IDS.map((id) => v.literal(id))
);
