import * as Sentry from '@sentry/nextjs';

import { scrubPII } from '@/lib/sentry/scrubPII';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  ...(dsn ? { dsn } : {}),
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  // Replay desligado temporariamente — investigando se o replay
  // integration interfere com o WebSocket do Supabase Realtime em prod.
  // Reativar apos confirmar.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: (event) => scrubPII(event),
});
