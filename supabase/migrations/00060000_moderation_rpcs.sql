-- 00060000_moderation_rpcs.sql

create or replace function public.claim_submission_for_send(p_submission_id uuid)
returns table (
  submission_id uuid,
  event_id uuid,
  event_slug text,
  event_name text,
  display_name text,
  comment text,
  webhook_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select e.owner_id into v_owner
  from public.submissions s
  join public.events e on e.id = s.event_id
  where s.id = p_submission_id and s.status = 'pending';

  if v_owner is null then return; end if;
  if v_owner <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.submissions
    set status = 'approved', approved_at = now()
    where id = p_submission_id and status = 'pending';

  return query
    select s.id, s.event_id, e.slug, e.name, s.name, s.comment, e.h2r_webhook_url
    from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id;
end;
$$;

grant execute on function public.claim_submission_for_send(uuid) to authenticated;

create or replace function public.mark_submission_sent(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'sent', sent_at = now(), error_message = null
    where id = p_submission_id;
end;
$$;

grant execute on function public.mark_submission_sent(uuid) to authenticated;

create or replace function public.mark_submission_failed(p_submission_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'failed', error_message = p_error
    where id = p_submission_id;
end;
$$;

grant execute on function public.mark_submission_failed(uuid, text) to authenticated;

create or replace function public.reject_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'rejected'
    where id = p_submission_id and status in ('pending', 'failed');
end;
$$;

grant execute on function public.reject_submission(uuid) to authenticated;

create or replace function public.reset_submission_for_retry(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.events e on e.id = s.event_id
    where s.id = p_submission_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'pending', error_message = null, approved_at = null, sent_at = null
    where id = p_submission_id and status = 'failed';
end;
$$;

grant execute on function public.reset_submission_for_retry(uuid) to authenticated;
