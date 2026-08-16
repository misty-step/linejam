import * as Sentry from '@sentry/nextjs';
import { beforeSend, beforeSendTransaction } from '@/lib/sentryPrivacy';
import { getSentryRuntimeOptions } from './sentry.runtime.mjs';

const runtimeOptions = getSentryRuntimeOptions();

type SentryServerTags = {
  runtime: 'node';
  environment: string;
  release?: string;
};

const serverTags: SentryServerTags = {
  runtime: 'node',
  environment: runtimeOptions.environment,
};

if (runtimeOptions.release) {
  serverTags.release = runtimeOptions.release;
}

if (!Sentry.getClient()) {
  Sentry.init({
    ...runtimeOptions,
    beforeBreadcrumb: () => null,
    beforeSend,
    beforeSendTransaction,
    initialScope: {
      tags: serverTags,
    },
  });
}
