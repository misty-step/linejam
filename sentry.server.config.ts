import * as Sentry from '@sentry/nextjs';
import { beforeSend, beforeSendTransaction } from '@/lib/sentryPrivacy';
import { getSentryRuntimeOptions } from './sentry.runtime.mjs';

const runtimeOptions = getSentryRuntimeOptions();

if (!Sentry.getClient()) {
  Sentry.init({
    ...runtimeOptions,
    beforeBreadcrumb: () => null,
    beforeSend,
    beforeSendTransaction,
    initialScope: {
      tags: {
        runtime: 'node',
        environment: runtimeOptions.environment,
        ...(runtimeOptions.release ? { release: runtimeOptions.release } : {}),
      },
    },
  });
}
