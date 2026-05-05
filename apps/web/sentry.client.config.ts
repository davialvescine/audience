import * as Sentry from '@sentry/nextjs';

import { scrubPII } from '@/lib/sentry/scrubPII';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  ...(dsn ? { dsn } : {}),
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  // Replay: 10% das sessões normais, 100% das que tiveram erro.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  beforeSend: (event) => scrubPII(event),
});
