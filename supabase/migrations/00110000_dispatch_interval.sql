-- 00110000_dispatch_interval.sql
-- Per-event dispatch pacing: how long to wait between consecutive H2R sends when flushing the queue.

alter table public.events
  add column if not exists dispatch_interval_seconds integer not null default 3
  check (dispatch_interval_seconds between 1 and 60);

comment on column public.events.dispatch_interval_seconds is
  'Seconds to wait between consecutive H2R sends when flushing the approved queue. 1-60. Default 3.';
