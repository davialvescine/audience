-- 00350000_event_assets_bucket.sql
-- Storage bucket pra assets de evento (background da nuvem, logo, etc).
-- Public read; uploads restritos a quem tem acesso ao evento via membership.

insert into storage.buckets (id, name, public)
values ('event-assets', 'event-assets', true)
on conflict (id) do nothing;

-- Convenção de path: <event_id>/<arbitrary>.<ext>
-- A primeira parte do path identifica o evento; usamos isso pra autorizar.

create policy "event_assets_public_read"
  on storage.objects
  for select
  using (bucket_id = 'event-assets');

create policy "event_assets_member_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'event-assets'
    and auth.uid() is not null
    and (
      exists (
        select 1
        from public.events e
        where e.id::text = split_part(name, '/', 1)
          and e.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.event_members m
        where m.event_id::text = split_part(name, '/', 1)
          and m.user_id = auth.uid()
      )
    )
  );

create policy "event_assets_member_update"
  on storage.objects
  for update
  using (
    bucket_id = 'event-assets'
    and auth.uid() is not null
    and (
      exists (
        select 1
        from public.events e
        where e.id::text = split_part(name, '/', 1)
          and e.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.event_members m
        where m.event_id::text = split_part(name, '/', 1)
          and m.user_id = auth.uid()
      )
    )
  );

create policy "event_assets_member_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'event-assets'
    and auth.uid() is not null
    and (
      exists (
        select 1
        from public.events e
        where e.id::text = split_part(name, '/', 1)
          and e.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.event_members m
        where m.event_id::text = split_part(name, '/', 1)
          and m.user_id = auth.uid()
      )
    )
  );
