-- 00120000_telao_modes.sql
-- Multi-mode display: each event can enable any combination of (h2r, browser_source, chrome_pip, desktop_app)
-- and customize visual settings shared across all modes.

create type public.telao_display_mode as enum ('h2r', 'browser_source', 'chrome_pip', 'desktop_app');

alter table public.events
  add column if not exists enabled_display_modes
    public.telao_display_mode[] not null default array['h2r']::public.telao_display_mode[];

alter table public.events
  add column if not exists telao_config jsonb not null default jsonb_build_object(
    'position', 'bottom-center',
    'widthPct', 90,
    'fontFamily', 'Inter',
    'fontSizePx', 32,
    'cardBg', 'rgba(10, 37, 64, 0.85)',
    'cardText', '#FFFFFF',
    'borderRadius', 16,
    'shadow', 'medium',
    'backdropBlur', 8,
    'animation', 'slide-up',
    'displaySeconds', 7,
    'maxConcurrent', 1,
    'showAvatar', false,
    'showTimestamp', false,
    'showEventName', false
  );

comment on column public.events.enabled_display_modes is
  'Display modes enabled for this event. Multiple modes can run in parallel.';
comment on column public.events.telao_config is
  'Visual config for the telão page (position, size, colors, animation, timing). Shared by all display modes.';

-- Public RPC so the /telao/[slug] page (anon) can fetch the config
create or replace function public.get_telao_config(p_slug text)
returns table (
  event_id uuid,
  event_name text,
  theme_id uuid,
  config jsonb
)
language sql
security definer
set search_path = public
as $$
  select id, name, theme_id, telao_config
  from public.events
  where slug = p_slug
  limit 1;
$$;

revoke execute on function public.get_telao_config(text) from public;
grant execute on function public.get_telao_config(text) to anon, authenticated;

-- Need to allow anon to subscribe to submissions changes for telão page
-- (read-only, only sent submissions visible)
create policy "submissions_telao_public_read" on public.submissions
  for select
  to anon
  using (status = 'sent');
