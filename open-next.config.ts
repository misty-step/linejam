import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from '@opennextjs/cloudflare';

export default {
  ...defineCloudflareConfig(),
  // The release wrapper owns Convex deployment. Never recursively run pnpm build.
  buildCommand: 'pnpm run build:check',
} satisfies OpenNextConfig;
