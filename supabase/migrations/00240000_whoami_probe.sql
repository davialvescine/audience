-- Diag: retorna auth.uid() do JWT atual.
create or replace function public.whoami_probe()
returns text
language sql
security invoker
stable
as $$
  select coalesce(auth.uid()::text, 'NULL');
$$;

grant execute on function public.whoami_probe() to anon, authenticated;
