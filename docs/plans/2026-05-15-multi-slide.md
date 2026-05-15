# Multi-slide System — Plano Técnico

> Branch: `feature/multi-slide` · Author: Davi + Claude · Date: 2026-05-15

## Objetivo

Transformar o evento de "1 toggle de nuvem" em **uma apresentação de N slides**, estilo Mentimeter/AhaSlides. Cada slide é uma pergunta independente (hoje só tipo `wordcloud`, no futuro `poll`, `open_ended`, etc.). Operador navega entre slides ao vivo; audiência e telão trocam de UI conforme o slide ativo.

### Casos de uso alvo

1. **Operador**: cria slides antes do evento — "slide 1: Em uma palavra, o que você espera?", "slide 2: O que mais te marcou?", "slide 3: Sugestões pra próximos encontros?". Reordena por drag-and-drop, edita textos, ativa.
2. **Durante o evento**: clica "Próximo" → telão troca de pergunta + audiência troca de UI no celular instantaneamente. Palavras enviadas no slide 1 não aparecem no slide 2 (cada um tem sua nuvem).
3. **Audiência**: abre `/e/<slug>` no celular. Vê **só** o input do slide ativo. Quando operador troca, UI muda sozinha.
4. **Telão**: `/telao/<slug>?mode=fullscreen` mostra apenas o slide ativo. Quando o operador troca, telão troca também.

### Não-objetivos

- Outros tipos de slide além de `wordcloud` (poll, quiz, rating, etc.) — schema fica preparado, mas só `wordcloud` ganha UI na V1.
- Animação de transição entre slides — slide simplesmente troca. Animação é polish pra depois.
- Histórico/timeline de slides antigos — operador pode reativar mas não há view de "passados".
- Export de resultados — depois.
- AI grouping de respostas — depois.

---

## Arquitetura

### Schema (Postgres / Supabase)

```sql
-- 00360000_slides_foundation.sql

create type slide_type as enum (
  'wordcloud',
  -- placeholders pra V2+:
  'poll', 'open_ended', 'rating', 'qa'
);

create table slides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type slide_type not null,
  position int not null,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, position)
);

create index slides_event_position_idx on slides (event_id, position);

alter table events
  add column active_slide_id uuid references slides(id) on delete set null;

-- RLS: owner + members podem CRUD; público pode ler
alter table slides enable row level security;
create policy slides_public_read on slides for select using (true);
create policy slides_member_all on slides for all using (
  exists (select 1 from events e where e.id = slides.event_id and e.owner_id = auth.uid())
  or exists (select 1 from event_members m where m.event_id = slides.event_id and m.user_id = auth.uid())
);

-- wordcloud_words ganha slide_id
alter table wordcloud_words
  add column slide_id uuid references slides(id) on delete cascade;
create index wordcloud_words_slide_idx on wordcloud_words (slide_id, created_at desc);
```

### Migração de dados (00370000_backfill_slides.sql)

```sql
-- 1. Cria 1 slide wordcloud por evento existente que tinha wordcloud_active=true
insert into slides (event_id, type, position, config)
select
  e.id,
  'wordcloud'::slide_type,
  0,
  e.wordcloud_config
from events e
where e.wordcloud_active = true;

-- 2. Associa palavras existentes ao slide do evento
update wordcloud_words w
set slide_id = s.id
from slides s
where s.event_id = w.event_id
  and s.type = 'wordcloud'
  and s.position = 0
  and w.slide_id is null;

-- 3. Marca esse slide como active
update events e
set active_slide_id = s.id
from slides s
where s.event_id = e.id and s.position = 0 and e.wordcloud_active = true;

-- 4. wordcloud_active e wordcloud_config ficam como legacy/compat por enquanto.
--    Remover em migration futura (00400000) após release estável.
```

### RPCs (00380000_slide_rpcs.sql)

```sql
create or replace function create_slide(p_event_id uuid, p_type slide_type, p_config jsonb default '{}'::jsonb)
returns slides language plpgsql security definer ...
-- Membership check, auto-positiona no fim, retorna slide criado

create or replace function update_slide(p_slide_id uuid, p_config jsonb)
returns slides language plpgsql security definer ...

create or replace function delete_slide(p_slide_id uuid)
returns void language plpgsql security definer ...
-- Cascade: se era active_slide_id, fica null. Reordena slides remanescentes.

create or replace function reorder_slides(p_event_id uuid, p_slide_ids uuid[])
returns void language plpgsql security definer ...
-- Atualiza position em batch baseado na ordem do array

create or replace function set_active_slide(p_event_id uuid, p_slide_id uuid)
returns events language plpgsql security definer ...

create or replace function get_active_slide(p_slug text)
returns table(slide_id uuid, slide_type slide_type, config jsonb, event_id uuid)
language sql security definer ...

create or replace function list_slides(p_event_id uuid)
returns setof slides language sql security definer ...
```

### Server actions (apps/web/server-actions/slides.ts)

Wrappers TS pra cada RPC. Validam com Zod, mapeiam erros pt-BR.

### Hooks

- `useActiveSlide(slug, initialActive, channel)` — substitui `useWordcloudActive`. Realtime subscribe em `events.active_slide_id` UPDATE. Retorna `{ slide: { id, type, config } | null }`.
- `useSlides(eventId, initialSlides)` — para a aba operador. Lista de slides + assina mudanças (criar/deletar/reordenar) via Realtime.
- `useWordCounts(slideId, channel, initialEntries)` — **muda assinatura**: filtra por `slide_id` em vez de `event_id`. Realtime filter: `slide_id=eq.${slideId}`.

### Componentes web

- `SlidesTab.tsx` (operador) — substitui `WordcloudTab.tsx`. Layout split:
  - **Esquerda (~340px)**: lista de slides com drag-and-drop. Botão "+ Novo slide".
  - **Direita**: editor do slide selecionado (pergunta, fundo, paleta, filtros — só o que se aplica a wordcloud por agora).
  - Botão "▶ Ativar" no slide ativo é mostrado como "● Ao vivo" em destaque.
- `SlideListItem.tsx` — card do slide na lista. Mostra: tipo, posição, pergunta truncada, badge "● Ao vivo" se ativo, drag handle.
- `NewSlideButton.tsx` — abre modal com seletor de tipo (V1: só `wordcloud`). Cria + ativa imediatamente.
- `WordcloudSlideEditor.tsx` — herda a UI atual do `WordcloudTab` (pergunta, aparência, filtros), mas opera sobre um `slide.config`.
- `ActiveSlideAudienceInput.tsx` — substitui `AudienceInputSwitcher`. Recebe slide, renderiza input do tipo certo.
- `ActiveSlideTelaoDisplay.tsx` — substitui `TelaoWordcloudSwitcher`. Recebe slide, renderiza display do tipo certo.

### Drag-and-drop

Usar `@dnd-kit/core` + `@dnd-kit/sortable` (~10 KB gzipped). Sem dependência extra do Framer Motion.

### Compatibilidade / rollback

- `events.wordcloud_active` e `events.wordcloud_config` **ficam** durante a transição. Servem como "fonte da verdade" pra eventos antigos onde a UI nova ainda não foi acessada.
- `wordcloud_words` tem `event_id` (legacy) **e** `slide_id` (novo). Submit de palavra usa `slide_id` quando vem do fluxo novo; ainda popula `event_id` pra compat.
- Cleanup: migration `00400000` (deletar colunas legacy + index) só depois de 2-3 semanas em prod com a UI nova.

---

## Plano de execução (TDD estrito)

### Fase A — Schema + dados (Davi aplica migrations no fim)

| # | Task | Arquivos | Test |
|---|---|---|---|
| A1 | Migration foundation | `supabase/migrations/00360000_slides_foundation.sql` | manual via `supabase db push --dry-run` |
| A2 | Migration backfill | `supabase/migrations/00370000_backfill_slides.sql` | manual com `SELECT count(*) FROM slides;` |
| A3 | Migration RPCs | `supabase/migrations/00380000_slide_rpcs.sql` | RPC contract tests via MSW |
| A4 | Regenerar tipos | `packages/shared-types/src/database.ts` | `pnpm db:types` |

### Fase B — Backend TS (cada task = RED→GREEN→COMMIT)

| # | Task | Arquivos | Tests |
|---|---|---|---|
| B1 | `lib/slides/types.ts` — TS shape pra Slide + SlideConfig por tipo | unit |
| B2 | `server-actions/slides.ts` — CRUD + reorder + setActive | MSW + unit |
| B3 | `server-actions/submitWord.ts` aceita `slide_id` (compat: aceita event-only durante migração) | MSW |
| B4 | `hooks/useActiveSlide.ts` (substitui `useWordcloudActive`, mantém shim) | fake channel |
| B5 | `hooks/useSlides.ts` — lista + realtime de mudanças | fake channel |
| B6 | `hooks/useWordCounts.ts` ganha `slideId` (legacy path mantém event_id) | timer + fake channel |

### Fase C — UI operador

| # | Task | Arquivos | Tests |
|---|---|---|---|
| C1 | `SlideListItem` — card single | component test |
| C2 | `SlidesList` — drag-and-drop com @dnd-kit | interaction test |
| C3 | `NewSlideButton` + modal de tipo | component test |
| C4 | `WordcloudSlideEditor` — extrai a UI atual do WordcloudTab | component test |
| C5 | `SlidesTab` — combina os 4 anteriores; layout split | snapshot |
| C6 | Substituir `WordcloudTab` por `SlidesTab` em `app/admin/events/[slug]/page.tsx` | E2E manual |

### Fase D — UI audiência + telão

| # | Task | Arquivos | Tests |
|---|---|---|---|
| D1 | `ActiveSlideAudienceInput` — wrapper que escolhe input por tipo | component test |
| D2 | `WordCloudAudienceInput` — extrai do `WordCloudInput` atual; recebe slide | component test |
| D3 | Substituir `AudienceInputSwitcher` por `ActiveSlideAudienceInput` em `PublicEventShell` | component test |
| D4 | `ActiveSlideTelaoDisplay` — wrapper telão | component test |
| D5 | Substituir `TelaoWordcloudSwitcher` por `ActiveSlideTelaoDisplay` em `app/telao/[slug]/page.tsx` | E2E manual |

### Fase E — Verificação + deploy

| # | Task |
|---|---|
| E1 | Smoke completo local: cria evento → cria 2 slides → ativa primeiro → audiência envia palavra → telão mostra → muda pra slide 2 → audiência vê pergunta nova → palavras antigas não aparecem |
| E2 | `pnpm ci:local` 100% verde |
| E3 | Apply migrations em prod (`supabase db push`) |
| E4 | Regen types em prod (`pnpm db:types`) + commit |
| E5 | Merge `feature/multi-slide` → `main` |
| E6 | Vercel auto-deploy |
| E7 | Smoke test em prod com evento real |

---

## Riscos + mitigações

| Risco | Mitigação |
|---|---|
| Migração de dados quebra eventos em produção | Backfill é additive (não deleta nada). Colunas legacy ficam. Rollback = reverter o `active_slide_id` setado. |
| Realtime de slide change é lento, audiência atrasa | Mesma infraestrutura já validada pro `wordcloud_active` (testado em prod). |
| Drag-and-drop conflita com touch no celular do operador | `@dnd-kit` suporta pointer + touch nativamente; ativação por delay de 250ms evita scroll acidental. |
| Eventos legacy sem slide ativo quebram audiência | `useActiveSlide` faz fallback: se `active_slide_id` é null e `wordcloud_active=true`, lê `wordcloud_config` legacy e renderiza nuvem. |
| Slide deletado enquanto ativo deixa evento "vazio" | RPC `delete_slide` automaticamente seta `active_slide_id = null` (cascade). Audiência mostra "Aguardando próximo slide…". |

---

## Estimativa

- **Fase A**: 1-2h (migrations + types)
- **Fase B**: 4-5h (backend TS, TDD denso)
- **Fase C**: 5-6h (UI operador com drag-and-drop)
- **Fase D**: 3-4h (audiência + telão refactor)
- **Fase E**: 1-2h (deploy + smoke)

**Total**: ~14-19h de trabalho focado, distribuído em 2-3 dias.

---

## Decisões pendentes (preciso de você antes de começar)

1. **Tipos de slide na V1**: só `wordcloud` (mais rápido pra entregar) **ou** já incluir `poll` (multipla escolha simples)? Recomendo só `wordcloud` na V1.
2. **Edição de slide ativo**: deixar editar a pergunta enquanto está ao vivo (atualiza audiência em real-time) **ou** bloquear edição quando ativo? Recomendo deixar editar — é o que Mentimeter faz.
3. **Limite de slides por evento**: hard cap em N (ex: 50)? Sem limite e confia no usuário? Recomendo cap em 50 com warning, hard error em 200.
4. **Nome da aba**: "Slides" **ou** "Apresentação" **ou** "Perguntas"? Recomendo "Slides".

Me responda essas 4 perguntas (mesmo que seja "vai como você recomendou") e eu começo pela Fase A.
