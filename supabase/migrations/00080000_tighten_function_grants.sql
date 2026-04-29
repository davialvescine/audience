-- 00080000_tighten_function_grants.sql
-- Removes default PUBLIC execute privilege on SECURITY DEFINER functions.
-- The functions still work for the intended roles (anon / authenticated / service_role)
-- because their explicit GRANTs in earlier migrations are preserved.

revoke execute on function public.submit_comment(text, text, text, text) from public;
revoke execute on function public.get_event_by_slug(text) from public;
revoke execute on function public.claim_submission_for_send(uuid) from public;
revoke execute on function public.mark_submission_sent(uuid) from public;
revoke execute on function public.mark_submission_failed(uuid, text) from public;
revoke execute on function public.reject_submission(uuid) from public;
revoke execute on function public.reset_submission_for_retry(uuid) from public;
-- redeem_pairing_code and record_heartbeat already revoked PUBLIC in 00070000
