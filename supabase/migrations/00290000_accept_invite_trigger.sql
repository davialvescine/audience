-- 00290000_accept_invite_trigger.sql
--
-- Marca invitations.accepted_at automaticamente quando o user define
-- senha (password_set vira true). Antes: nunca era marcado, e o status
-- "Pendente" ficava preso pra sempre na pagina de usuarios.

create or replace function public.mark_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_set text;
  v_new_set text;
begin
  v_old_set := coalesce((old.raw_user_meta_data->>'password_set'), 'false');
  v_new_set := coalesce((new.raw_user_meta_data->>'password_set'), 'false');

  if v_new_set = 'true' and v_old_set <> 'true' then
    update public.invitations
      set accepted_at = now()
      where lower(email) = lower(new.email)
        and accepted_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_mark_invitation_accepted on auth.users;
create trigger tr_mark_invitation_accepted
  after update on auth.users
  for each row execute function public.mark_invitation_accepted();

-- Backfill: usuarios que ja tem password_set=true mas o invite nunca
-- foi marcado como aceito.
update public.invitations i
  set accepted_at = coalesce(u.last_sign_in_at, u.email_confirmed_at, now())
  from auth.users u
  where lower(u.email) = lower(i.email)
    and i.accepted_at is null
    and (u.raw_user_meta_data->>'password_set') = 'true';
