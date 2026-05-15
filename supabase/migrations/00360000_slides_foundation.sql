-- 00360000_slides_foundation.sql
-- Multi-slide system: cada evento passa a ter N slides ordenados. V1 só tem
-- tipo 'wordcloud' habilitado na UI; o enum já lista placeholders pra futuros
-- tipos (poll, open_ended, etc) pra evitar migration extra depois.

create type public.slide_type as enum (
  'wordcloud',
  'poll',
  'open_ended',
  'rating',
  'qa'
);

create table public.slides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type public.slide_type not null,
  position int not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slides_event_position_uk unique (event_id, position) deferrable initially deferred
);

create index slides_event_position_idx on public.slides (event_id, position);

alter table public.events
  add column active_slide_id uuid references public.slides(id) on delete set null;

-- RLS: leitura pública (audiência + telão precisam ler), escrita só owner/member
alter table public.slides enable row level security;

create policy "slides_public_read"
  on public.slides
  for select
  using (true);

create policy "slides_member_all"
  on public.slides
  for all
  using (
    auth.uid() is not null
    and (
      exists (
        select 1 from public.events e
        where e.id = slides.event_id and e.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.event_members m
        where m.event_id = slides.event_id and m.user_id = auth.uid()
      )
    )
  );

-- wordcloud_words ganha slide_id (nullable durante migração; populado pelo backfill)
alter table public.wordcloud_words
  add column slide_id uuid references public.slides(id) on delete cascade;

create index wordcloud_words_slide_recent_idx
  on public.wordcloud_words (slide_id, created_at desc);

create index wordcloud_words_slide_word_idx
  on public.wordcloud_words (slide_id, word);

-- Realtime publication para slides (UI escuta UPDATE em events.active_slide_id +
-- INSERT/DELETE/UPDATE em slides pra atualizar lista no operador)
alter publication supabase_realtime add table public.slides;
alter table public.slides replica identity full;

-- Trigger pra updated_at automático
create or replace function public.touch_slides_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger slides_touch_updated_at
  before update on public.slides
  for each row execute function public.touch_slides_updated_at();
