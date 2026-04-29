-- 00070000_pairing_rpcs.sql

create or replace function public.redeem_pairing_code(
  p_code text,
  p_tunnel_url text,
  p_source_id text
)
returns table (event_id uuid, event_name text, heartbeat_secret text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.pairing_codes;
  v_event_id uuid;
  v_webhook_url text;
  v_now timestamptz := now();
begin
  select * into v_code from public.pairing_codes where code = p_code;
  if v_code is null then
    raise exception 'code_not_found' using errcode = 'P0001';
  end if;
  if v_code.consumed_at is not null then
    raise exception 'code_consumed' using errcode = 'P0001';
  end if;
  if v_code.expires_at < v_now then
    raise exception 'code_expired' using errcode = 'P0001';
  end if;

  v_event_id := v_code.event_id;
  v_webhook_url := rtrim(p_tunnel_url, '/') || '/data/' || p_source_id;

  update public.events
    set h2r_webhook_url = v_webhook_url,
        h2r_source_id = p_source_id,
        h2r_paired_at = v_now,
        h2r_last_heartbeat = v_now
    where id = v_event_id;

  update public.pairing_codes
    set consumed_at = v_now
    where code = p_code;

  return query
    select e.id, e.name, v_code.heartbeat_secret
    from public.events e
    where e.id = v_event_id;
end;
$$;

revoke all on function public.redeem_pairing_code(text, text, text) from public, anon, authenticated;
grant execute on function public.redeem_pairing_code(text, text, text) to service_role;

create or replace function public.record_heartbeat(p_event_id uuid, p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
begin
  select exists (
    select 1 from public.pairing_codes
    where event_id = p_event_id and heartbeat_secret = p_secret
  ) into v_valid;

  if not v_valid then return false; end if;

  update public.events
    set h2r_last_heartbeat = now()
    where id = p_event_id;

  return true;
end;
$$;

revoke all on function public.record_heartbeat(uuid, text) from public, anon, authenticated;
grant execute on function public.record_heartbeat(uuid, text) to service_role;
