-- 00330000_wordcloud.sql
-- Adds wordcloud interaction mode: per-event toggle + config + submissions table.

-- Per-event toggle + config -------------------------------------------------
alter table public.events
  add column wordcloud_active boolean not null default false;

alter table public.events
  add column wordcloud_config jsonb not null default jsonb_build_object(
    'question', 'Em uma palavra, o que você espera deste evento?',
    'maxWordsPerSubmission', 1,
    'filterStopwords', true,
    'filterProfanity', true,
    'palette', jsonb_build_array(
      '#FF6B6B','#4ECDC4','#FFE66D','#95E1D3','#F38181','#AA96DA','#FCBAD3','#A8E6CF'
    ),
    'showTotal', true
  );

-- Submissions: 1 row per word per user ------------------------------------
create table public.wordcloud_words (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 30),
  ip_hash text,
  created_at timestamptz not null default now()
);

create index wordcloud_words_event_recent_idx
  on public.wordcloud_words (event_id, created_at desc);

create index wordcloud_words_event_word_idx
  on public.wordcloud_words (event_id, word);

alter table public.wordcloud_words enable row level security;

-- Public read so the operator and audience can poll counts; writes are
-- locked to the submit_word SECURITY DEFINER RPC (added in 00340000).
create policy "wordcloud_words_public_read"
  on public.wordcloud_words
  for select
  using (true);

-- Realtime publication for the telao -------------------------------------
alter publication supabase_realtime add table public.wordcloud_words;
alter table public.wordcloud_words replica identity full;
