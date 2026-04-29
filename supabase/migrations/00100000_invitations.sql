-- 00100000_invitations.sql
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_email_idx on public.invitations(email);

alter table public.invitations enable row level security;

create policy "invitations_owner_select" on public.invitations
  for select
  using (auth.uid() = invited_by);

-- Insert / update happen via service role only (admin API).
