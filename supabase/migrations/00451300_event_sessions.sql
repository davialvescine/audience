-- F5: Sessões dentro do evento.
--
-- Cada Evento pode ter múltiplas Sessões (palestras, dias, turnos).
-- Cada Sessão isola os dados gerados pela audiência (comentários,
-- palavras da nuvem, votos de enquete, respostas abertas). Slides e
-- configs do telão continuam reaproveitáveis no evento todo.
--
-- 1 sessão ATIVA por evento por vez. Trocar de sessão = audiência vê
-- telão vazio (dados antigos preservados, consultáveis depois).
--
-- Backfill: cada evento existente ganha "Sessão 1" automaticamente, e
-- todos os dados antigos (submissions/words/votes/responses) viram dela.

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index event_sessions_event_idx on public.event_sessions(event_id, position);

-- Pointer da sessão ativa do evento. Atualizado por set_active_session.
alter table public.events
  add column active_session_id uuid references public.event_sessions(id) on delete set null;

-- session_id em todas as tabelas de dados da audiência. ON DELETE CASCADE
-- garante que apagar uma sessão remove seus dados (não orphans).
alter table public.submissions
  add column session_id uuid references public.event_sessions(id) on delete cascade;
alter table public.wordcloud_words
  add column session_id uuid references public.event_sessions(id) on delete cascade;
alter table public.poll_votes
  add column session_id uuid references public.event_sessions(id) on delete cascade;
alter table public.open_ended_responses
  add column session_id uuid references public.event_sessions(id) on delete cascade;

create index submissions_session_idx on public.submissions(session_id, status, created_at desc);
create index wordcloud_words_session_idx on public.wordcloud_words(session_id, created_at desc);
create index poll_votes_session_idx on public.poll_votes(session_id, slide_id);
create index open_ended_responses_session_idx on public.open_ended_responses(session_id, slide_id, created_at desc);

-- BACKFILL: cada evento existente ganha "Sessão 1" como ativa.
do $$
declare e record;
declare s uuid;
begin
  for e in select id from public.events loop
    insert into public.event_sessions(event_id, name, position) values (e.id, 'Sessão 1', 0) returning id into s;
    update public.events set active_session_id = s where id = e.id;
    update public.submissions set session_id = s where event_id = e.id;
    update public.wordcloud_words set session_id = s where event_id = e.id;
    update public.poll_votes set session_id = s where event_id = e.id;
    update public.open_ended_responses set session_id = s where event_id = e.id;
  end loop;
end $$;

-- Constraint NOT NULL DEPOIS do backfill (todos os rows agora têm session_id).
alter table public.submissions alter column session_id set not null;
alter table public.wordcloud_words alter column session_id set not null;
alter table public.poll_votes alter column session_id set not null;
alter table public.open_ended_responses alter column session_id set not null;

-- RLS — herda permissão do event (owner ou member).
alter table public.event_sessions enable row level security;
create policy event_sessions_owner_member_all on public.event_sessions
  for all to authenticated
  using (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
    or exists (
      select 1 from public.event_members m where m.event_id = event_sessions.event_id and m.user_id = auth.uid()
    )
  );

-- Trigger: ao INSERT em events, auto-cria "Sessão 1" e marca como ativa.
-- Permite createEvent server action continuar funcionando sem alteração.
create or replace function public._auto_create_first_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  insert into public.event_sessions(event_id, name, position)
  values (new.id, 'Sessão 1', 0)
  returning id into v_session_id;
  update public.events set active_session_id = v_session_id where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_event_auto_session on public.events;
create trigger trg_event_auto_session
  after insert on public.events
  for each row execute function public._auto_create_first_session();
