import * as Sentry from '@sentry/nextjs';
import { beforeSend, beforeSendTransaction } from '@/lib/sentryPrivacy';
import { getSentryRuntimeOptions } from './sentry.runtime.mjs';

const runtimeOptions = getSentryRuntimeOptions({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENABLED: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  NODE_ENV: process.env.NODE_ENV,
});

type SentryClientTags = {
  runtime: 'browser';
  environment: string;
  release?: string;
};

const clientTags: SentryClientTags = {
  runtime: 'browser',
  environment: runtimeOptions.environment,
};

if (runtimeOptions.release) {
  clientTags.release = runtimeOptions.release;
}

if (!Sentry.getClient()) {
  Sentry.init({
    ...runtimeOptions,
    beforeBreadcrumb: () => null,
    beforeSend,
    beforeSendTransaction,
    initialScope: {
      tags: clientTags,
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
