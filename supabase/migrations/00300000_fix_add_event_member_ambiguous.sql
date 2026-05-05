-- 00300000_fix_add_event_member_ambiguous.sql
--
-- Bug: add_event_member tem return table (user_id, email) e referencia
-- auth.users.email no WHERE sem alias, gerando "column reference 'email'
-- is ambiguous". Mesmo padrao do bug 00200000.

create or replace function public.add_event_member(p_event_id uuid, p_email text)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user uuid;
  v_email_norm text;
begin
  if not exists (
    select 1 from public.events e where e.id = p_event_id and e.owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_email_norm := lower(trim(p_email));
  select u.id into v_target_user from auth.users u where lower(u.email) = v_email_norm;
  if v_target_user is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  insert into public.event_members (event_id, user_id, added_by)
  values (p_event_id, v_target_user, auth.uid())
  on conflict do nothing;

  return query select v_target_user, v_email_norm;
end;
$$;
