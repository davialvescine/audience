-- 00190000_moderator_tokens.sql
--
-- Sprint 2 item 2.9: link de moderador sem login.
--
-- Caso de uso: dono do evento gera um link (URL com token) e manda pro
-- voluntario via WhatsApp/Telegram. Voluntario abre no celular, modera
-- comentarios desse evento — sem cadastro, sem senha, sem email.
--
-- Seguranca:
--   - Token = 32 bytes random base64url, gerado client-side.
--   - Cada token e scoped a UM evento. Nao acessa nada alem dele.
--   - Expiracao default 24h, configuravel pelo dono.
--   - Revogacao via flag revoked_at.
--   - Toda operacao via RPC security-definer que valida o token e checa
--     scope/expiracao a cada chamada.

create table public.moderator_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token text not null unique,
  display_name text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index moderator_tokens_event_idx on public.moderator_tokens(event_id);
create index moderator_tokens_token_idx on public.moderator_tokens(token);

alter table public.moderator_tokens enable row level security;

-- Owner do evento ve / cria / revoga seus tokens.
create policy "moderator_tokens_owner_all" on public.moderator_tokens
  for all
  using (
    exists (
      select 1 from public.events e
      where e.id = moderator_tokens.event_id and e.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = moderator_tokens.event_id and e.owner_id = auth.uid()
    )
  );

-- Helper: valida token e retorna o event_id, ou null se invalido.
-- Atualiza last_used_at em cada chamada bem-sucedida.
create or replace function public.validate_moderator_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_token_id uuid;
begin
  select id, event_id into v_token_id, v_event_id
  from public.moderator_tokens
  where token = p_token
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if v_token_id is null then return null; end if;

  update public.moderator_tokens
    set last_used_at = now()
    where id = v_token_id;

  return v_event_id;
end;
$$;

grant execute on function public.validate_moderator_token(text) to anon, authenticated;

-- Lista submissions de um evento via token. RLS owner-only continua,
-- mas o SD bypass aqui e seguro porque validamos o token primeiro.
create or replace function public.get_submissions_via_token(
  p_token text,
  p_status_filter text default null
)
returns table (
  id uuid,
  name text,
  comment text,
  status submission_status,
  created_at timestamptz,
  error_message text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_event_id uuid;
begin
  v_event_id := public.validate_moderator_token(p_token);
  if v_event_id is null then
    raise exception 'invalid_token' using errcode = '42501';
  end if;

  return query
    select s.id, s.name, s.comment, s.status, s.created_at, s.error_message
    from public.submissions s
    where s.event_id = v_event_id
      and (p_status_filter is null or s.status::text = p_status_filter)
    order by s.created_at desc
    limit 200;
end;
$$;

grant execute on function public.get_submissions_via_token(text, text) to anon, authenticated;

-- Aprova/rejeita um submission via token. So permite acoes em pending.
-- Aprovacao via token e mais limitada que via admin: vai direto pra
-- 'approved'; o flush manual / H2R fica com o dono na admin.
create or replace function public.moderate_with_token(
  p_token text,
  p_submission_id uuid,
  p_action text  -- 'approve' | 'reject'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_target_event uuid;
begin
  v_event_id := public.validate_moderator_token(p_token);
  if v_event_id is null then
    raise exception 'invalid_token' using errcode = '42501';
  end if;

  -- Garantir que o submission pertence ao evento do token.
  select event_id into v_target_event
  from public.submissions
  where id = p_submission_id;
  if v_target_event is null or v_target_event <> v_event_id then
    raise exception 'submission_not_in_token_scope' using errcode = '42501';
  end if;

  if p_action = 'approve' then
    update public.submissions
      set status = 'approved', approved_at = now()
      where id = p_submission_id and status = 'pending';
  elsif p_action = 'reject' then
    update public.submissions
      set status = 'rejected'
      where id = p_submission_id and status in ('pending', 'failed');
  else
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function public.moderate_with_token(text, uuid, text) to anon, authenticated;
