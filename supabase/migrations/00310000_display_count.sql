-- 00310000_display_count.sql
--
-- Conta quantas vezes uma mensagem foi exibida no telao. Cada vez que
-- vai pra status='sent' (primeira aprovacao OU reshow) incrementa.
-- Operador ve "Exibida 3x" no card.

alter table public.submissions
  add column if not exists display_count int not null default 0;

-- Backfill: mensagens que ja foram enviadas antes contam como 1.
update public.submissions
  set display_count = 1
  where status = 'sent' and display_count = 0;

-- mark_submission_sent agora incrementa o contador.
create or replace function public.mark_submission_sent(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.submissions s
    join public.event_members em on em.event_id = s.event_id
    where s.id = p_submission_id and em.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.submissions
    set status = 'sent',
        sent_at = now(),
        error_message = null,
        display_count = display_count + 1
    where id = p_submission_id;
end;
$$;
