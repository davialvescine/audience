-- 00090000_revoke_anon_from_moderation.sql
-- Explicitly revoke anon execute on moderation RPCs.
-- These should only be callable by signed-in event owners (authenticated role).
-- The functions also enforce auth.uid() = owner_id internally, so anon calls would fail anyway,
-- but defense-in-depth + clean linter dashboard.

revoke execute on function public.claim_submission_for_send(uuid) from anon;
revoke execute on function public.mark_submission_sent(uuid) from anon;
revoke execute on function public.mark_submission_failed(uuid, text) from anon;
revoke execute on function public.reject_submission(uuid) from anon;
revoke execute on function public.reset_submission_for_retry(uuid) from anon;

-- Document intent for the 2 functions that ARE intentionally anon-callable
-- (linter will still warn for these — those warnings are expected and acceptable)
comment on function public.submit_comment(text, text, text, text) is
  'Public form RPC. Intentionally callable by anon role. Validates event existence, submission window, length, and rate limit (5/min/IP) internally.';
comment on function public.get_event_by_slug(text) is
  'Public lookup. Intentionally callable by anon role. Returns only safe columns (id, slug, name, theme_id, submissions_open). Used by /e/[slug] page.';
