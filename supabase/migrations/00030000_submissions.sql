-- 00030000_submissions.sql
create type public.submission_status as enum ('pending', 'approved', 'rejected', 'sent', 'failed');

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  comment text not null check (char_length(comment) between 1 and 280),
  status public.submission_status not null default 'pending',
  ip_hash text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz,
  error_message text
);

create index submissions_event_status_idx on public.submissions(event_id, status, created_at desc);

alter table public.submissions enable row level security;

create policy "submissions_owner_all" on public.submissions
  for all
  using (
    exists (
      select 1 from public.events e
      where e.id = submissions.event_id and e.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = submissions.event_id and e.owner_id = auth.uid()
    )
  );
