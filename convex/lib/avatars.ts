import { v } from 'convex/values';
import { AVATAR_IDS } from '../../lib/avatars';

export const avatarIdValidator = v.union(
  ...AVATAR_IDS.map((id) => v.literal(id))
);
