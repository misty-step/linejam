import * as Sentry from '@sentry/nextjs';
import { beforeSend, beforeSendTransaction } from '@/lib/sentryPrivacy';
import { getSentryRuntimeOptions } from './sentry.runtime.mjs';

const runtimeOptions = getSentryRuntimeOptions();

type SentryEdgeTags = {
  runtime: 'edge';
  environment: string;
  release?: string;
};

const edgeTags: SentryEdgeTags = {
  runtime: 'edge',
  environment: runtimeOptions.environment,
};

if (runtimeOptions.release) {
  edgeTags.release = runtimeOptions.release;
}

if (!Sentry.getClient()) {
  Sentry.init({
    ...runtimeOptions,
    beforeBreadcrumb: () => null,
    beforeSend,
    beforeSendTransaction,
    initialScope: {
      tags: edgeTags,
    },
  });
}
