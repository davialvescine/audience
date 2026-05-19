-- Contador público de comentários enviados ao telão. Usado pelo
-- StatsBadge dos slides pra mostrar "X comentários · Y online".
-- Anon-friendly (RLS bloqueia SELECT direto em submissions, mas via
-- security definer dá pra expor só o count).

create or replace function public.count_event_sent_submissions(p_slug text)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint
    from public.submissions s
    join public.events e on e.id = s.event_id
   where e.slug = p_slug
     and s.status = 'sent';
$$;

grant execute on function public.count_event_sent_submissions(text) to anon, authenticated;
