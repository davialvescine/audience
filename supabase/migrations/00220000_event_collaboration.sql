-- 00220000_event_collaboration.sql
--
-- Eventos compartilhados entre multiplos usuarios. Antes: 1 evento = 1
-- owner. Agora: 1 evento pode ter N membros (todos veem mesma fila,
-- todos podem aprovar/rejeitar). Audit trail registra quem aprovou.
--
-- Backwards-compat: o owner_id do events fica como source-of-truth da
-- propriedade; event_members duplica como helper pra RLS escalar pra N
-- membros sem alterar a coluna existente.

-- ── 1. Schema ────────────────────────────────────────────────────────

create table public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id),
  primary key (event_id, user_id)
);

create index event_members_user_idx on public.event_members(user_id);

-- Adiciona coluna pra rastrear quem moderou cada submission.
alter table public.submissions
  add column if not exists moderated_by uuid references auth.users(id);

-- Backfill: cada owner existente vira membro do proprio evento.
insert into public.event_members (event_id, user_id, added_by)
select id, owner_id, owner_id from public.events
on conflict do nothing;

-- ── 2. RLS em event_members ─────────────────────────────────────────

alter table public.event_members enable row level security;

-- Membros podem ver outros membros do mesmo evento.
create policy "event_members_visible_to_members" on public.event_members
  for select
  using (
    exists (
      select 1 from public.event_members em
      where em.event_id = event_members.event_id and em.user_id = auth.uid()
    )
  );

-- Apenas owner do evento pode adicionar/remover membros.
create policy "event_members_managed_by_owner" on public.event_members
  for all
  using (
    exists (
      select 1 from public.events e
      where e.id = event_members.event_id and e.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_members.event_id and e.owner_id = auth.uid()
    )
  );

-- ── 3. RLS atualizada em events ─────────────────────────────────────

drop policy if exists "events_owner_all" on public.events;

-- Owner tem all-access; membros tem read-only via RLS (a admin UI
-- gates write actions a owner via server actions).
create policy "events_owner_all" on public.events
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "events_visible_to_members" on public.events
  for select
  using (
    exists (
      select 1 from public.event_members em
      where em.event_id = events.id and em.user_id = auth.uid()
    )
  );

-- ── 4. RLS atualizada em submissions ────────────────────────────────

drop policy if exists "submissions_owner_all" on public.submissions;

create policy "submissions_member_all" on public.submissions
  for all
  using (
    exists (
      select 1 from public.event_members em
      where em.event_id = submissions.event_id and em.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.event_members em
      where em.event_id = submissions.event_id and em.user_id = auth.uid()
    )
  );

-- ── 5. RPCs atualizados pra suportar membros ────────────────────────

-- claim_submission_for_send: aceita qualquer membro (nao so owner) e
-- registra moderated_by.
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
  v_member_event uuid;
  v_claimed_id uuid;
begin
  update public.submissions s
     set status = 'approved', approved_at = now(), moderated_by = auth.uid()
   where s.id = p_submission_id
     and s.status = 'pending'
     and s.event_id in (
       select em.event_id from public.event_members em where em.user_id = auth.uid()
     )
  returning s.id into v_claimed_id;

  if v_claimed_id is not null then
    return query
      select s.id, s.event_id, e.slug, e.name, s.name, s.comment, e.h2r_webhook_url
      from public.submissions s
      join public.events e on e.id = s.event_id
      where s.id = p_submission_id;
    return;
  end if;

  -- Nao claim: existe? membro?
  select s.event_id into v_member_event
  from public.submissions s
  join public.event_members em on em.event_id = s.event_id and em.user_id = auth.uid()
  where s.id = p_submission_id;

  if v_member_event is null then
    -- Submission nao existe OU usuario nao e membro do evento
    return;
  end if;

  -- E membro mas claim falhou (race ou status nao era pending). Empty.
  return;
end;
$$;

-- reject_submission: aceita membro e registra moderated_by.
create or replace function public.reject_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.event_members em on em.event_id = s.event_id
    where s.id = p_submission_id and em.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'rejected', moderated_by = auth.uid()
    where id = p_submission_id and status in ('pending', 'failed');
end;
$$;

-- mark_submission_sent / mark_submission_failed: aceita membro.
create or replace function public.mark_submission_sent(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.event_members em on em.event_id = s.event_id
    where s.id = p_submission_id and em.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'sent', sent_at = now(), error_message = null
    where id = p_submission_id;
end;
$$;

create or replace function public.mark_submission_failed(p_submission_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.event_members em on em.event_id = s.event_id
    where s.id = p_submission_id and em.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'failed', error_message = p_error
    where id = p_submission_id;
end;
$$;

create or replace function public.reset_submission_for_retry(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.event_members em on em.event_id = s.event_id
    where s.id = p_submission_id and em.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'pending', error_message = null, approved_at = null, sent_at = null
    where id = p_submission_id and status = 'failed';
end;
$$;

-- ── 6. RPC nova: adicionar/remover membro por email ────────────────

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
  -- Apenas owner pode adicionar membro.
  if not exists (
    select 1 from public.events where id = p_event_id and owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_email_norm := lower(trim(p_email));
  select id into v_target_user from auth.users where lower(email) = v_email_norm;
  if v_target_user is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  insert into public.event_members (event_id, user_id, added_by)
  values (p_event_id, v_target_user, auth.uid())
  on conflict do nothing;

  return query select v_target_user, v_email_norm;
end;
$$;

grant execute on function public.add_event_member(uuid, text) to authenticated;

create or replace function public.remove_event_member(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.events where id = p_event_id and owner_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Nao permite remover o owner.
  if p_user_id = (select owner_id from public.events where id = p_event_id) then
    raise exception 'cannot_remove_owner' using errcode = 'P0001';
  end if;

  delete from public.event_members
    where event_id = p_event_id and user_id = p_user_id;
end;
$$;

grant execute on function public.remove_event_member(uuid, uuid) to authenticated;

-- RPC pra listar membros com email (auth.users e protegida, expomos
-- via SD scoped ao evento).
create or replace function public.list_event_members(p_event_id uuid)
returns table (user_id uuid, email text, added_at timestamptz, is_owner boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.event_members
    where event_id = p_event_id and user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select em.user_id, u.email::text, em.added_at,
      (em.user_id = (select owner_id from public.events where id = p_event_id)) as is_owner
    from public.event_members em
    join auth.users u on u.id = em.user_id
    where em.event_id = p_event_id
    order by is_owner desc, em.added_at asc;
end;
$$;

grant execute on function public.list_event_members(uuid) to authenticated;

-- moderator email lookup pra exibir quem aprovou cada submission.
create or replace function public.get_moderator_email(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_email text;
  v_caller_event uuid;
begin
  -- Deve haver pelo menos um evento em que o caller e member com
  -- submissions moderadas pelo p_user_id; senao bloqueia.
  select s.event_id into v_caller_event
  from public.submissions s
  join public.event_members em on em.event_id = s.event_id and em.user_id = auth.uid()
  where s.moderated_by = p_user_id
  limit 1;

  if v_caller_event is null then return null; end if;

  select u.email::text into v_email from auth.users u where u.id = p_user_id;
  return v_email;
end;
$$;

grant execute on function public.get_moderator_email(uuid) to authenticated;
