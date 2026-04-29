import * as Sentry from '@sentry/nextjs';

Sentry.init({
  ...(process.env.NEXT_PUBLIC_SENTRY_DSN ? { dsn: process.env.NEXT_PUBLIC_SENTRY_DSN } : {}),
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
