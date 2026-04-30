-- 00130000_per_mode_configs.sql
-- Per-mode visual configurations: each visual mode (browser_source, chrome_pip, desktop_app)
-- can have its own appearance config so the user can have one look in OBS and another in Chrome PiP.
-- The legacy telao_config column stays as a fallback default.

alter table public.events
  add column if not exists telao_configs jsonb not null default '{}'::jsonb;

comment on column public.events.telao_configs is
  'Per-mode visual configs keyed by display mode. Falls back to telao_config (global default) if a mode key is missing.';

-- Update the public RPC to also return the per-mode configs map
drop function if exists public.get_telao_config(text);
create or replace function public.get_telao_config(p_slug text)
returns table (
  event_id uuid,
  event_name text,
  theme_id uuid,
  config jsonb,
  configs jsonb
)
language sql
security definer
set search_path = public
as $$
  select id, name, theme_id, telao_config, telao_configs
  from public.events
  where slug = p_slug
  limit 1;
$$;

revoke execute on function public.get_telao_config(text) from public;
grant execute on function public.get_telao_config(text) to anon, authenticated;
