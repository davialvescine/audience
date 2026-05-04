// Sentry beforeSend hook helper. Removes PII from events before they
// leave the user's browser/server: audience names, comments, e-mails,
// usernames. Run as `beforeSend: (e) => scrubPII(e)`.

const REDACTED = '[redacted]';

// Keys whose VALUES contain PII regardless of nesting depth.
const REDACTED_KEYS = new Set(['email', 'username', 'name', 'comment', 'commentText', 'displayName']);

type AnyRecord = Record<string, unknown>;

function isPlainObject(v: unknown): v is AnyRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepRedact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepRedact);
  if (!isPlainObject(value)) return value;
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACTED_KEYS.has(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = deepRedact(v);
    }
  }
  return out;
}

export function scrubPII<T>(event: T): T {
  if (event === null || event === undefined) return event;
  return deepRedact(event) as T;
}
