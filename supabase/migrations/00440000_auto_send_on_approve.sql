-- Flag por evento: quando true, aprovar uma submission marca direto
-- como 'sent' (vai pro telão na hora). Default false mantém o comportamento
-- antigo (aprovar deixa em 'approved', operador clica "Mostrar no telão").
alter table public.events
  add column if not exists auto_send_on_approve boolean not null default false;

comment on column public.events.auto_send_on_approve is
  'Quando true, approveSubmission marca direto como sent (auto-display no telão).';
