import * as Sentry from '@sentry/nextjs';

import { scrubPII } from '@/lib/sentry/scrubPII';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  ...(dsn ? { dsn } : {}),
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubPII(event),
});
