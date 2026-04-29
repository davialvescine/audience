-- 00040000_submit_comment_rpc.sql
create or replace function public.submit_comment(
  p_slug text,
  p_name text,
  p_comment text,
  p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_open boolean;
  v_count int;
  v_submission_id uuid;
begin
  select id, submissions_open into v_event_id, v_open
  from public.events where slug = p_slug;

  if v_event_id is null then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  if not v_open then
    raise exception 'submissions_closed' using errcode = 'P0001';
  end if;

  if char_length(coalesce(p_name, '')) < 1 or char_length(p_name) > 60 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_comment, '')) < 1 or char_length(p_comment) > 280 then
    raise exception 'invalid_comment' using errcode = 'P0001';
  end if;

  if p_ip_hash is not null then
    select count(*) into v_count
    from public.submissions
    where ip_hash = p_ip_hash
      and created_at > now() - interval '60 seconds';
    if v_count >= 5 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;

  insert into public.submissions (event_id, name, comment, ip_hash, status)
  values (v_event_id, p_name, p_comment, p_ip_hash, 'pending')
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

grant execute on function public.submit_comment(text, text, text, text) to anon, authenticated;
