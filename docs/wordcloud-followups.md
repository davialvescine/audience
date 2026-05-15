# Wordcloud — Follow-ups e Roadmap

Tudo que ficou fora do release inicial da nuvem de palavras, em ordem de prioridade.

## 1. Aplicar migrations em produção (BLOQUEANTE)

A feature **não funciona em produção** até as migrations serem aplicadas. Estão escritas e commitadas mas NÃO foram aplicadas.

```bash
cd /Users/davialves/development/Audience
supabase db push          # aplica 00330000_wordcloud.sql + 00340000_wordcloud_rpcs.sql
pnpm db:types             # regenera packages/shared-types/src/database.ts
```

Depois remover os casts `as unknown as ...` em:
- `apps/web/app/telao/[slug]/page.tsx`
- `apps/web/app/admin/events/[slug]/page.tsx`
- `apps/web/app/(public)/e/[slug]/page.tsx`
- `apps/web/server-actions/submitWord.ts`
- `apps/web/server-actions/wordcloud.ts`

E remover o `// eslint-disable-next-line` correspondente.

## 2. Habilitar specs E2E

Após aplicar migrations:

1. Seedar evento de teste: `pnpm tsx scripts/seed-wordcloud-test-event.ts` (criar)
2. Salvar storage state do operador: `pnpm exec playwright codegen` → login → salvar em `apps/web/e2e/.auth/operator.json`
3. Remover `.skip` de:
   - `apps/web/e2e/wordcloud-flow.spec.ts`
   - `apps/web/e2e/wordcloud-visual.spec.ts`
4. Adicionar `webServer` block ao `playwright.config.ts` pra subir `pnpm dev` automaticamente

## 3. Contador de pessoas online no slide da nuvem (pedido do Davi)

Quando wordcloud_active=true, mostrar no canto do telão um badge tipo "X pessoas online" via Supabase Realtime Presence.

### Implementação

Shipped:
- `apps/web/hooks/useOnlinePresence.ts` — telão escuta `sync` e retorna `{ count, isConnected }`
- `apps/web/hooks/usePresenceJoin.ts` — audiência faz `track({ clientId, joinedAt })` com UUID estável em localStorage (`audience.clientId`)
- `apps/web/components/telao/OnlineBadge.tsx` — pill top-right com animação de pulso quando o count muda
- Wire em `TelaoWordcloudSwitcher` e `AudienceInputSwitcher` no canal compartilhado `presence:event:<eventId>`

Cobertura adicionada: 20 testes (5 fake-channel + 5 useOnlinePresence + 6 usePresenceJoin + 5 OnlineBadge - 1 já contado). Total geral pulou pra 193 testes.

E2E ainda **não** cobre presença — adicionar ao `wordcloud-flow.spec.ts` quando habilitar os specs (item #2 acima).

## 4. Limpeza pós-deploy

- Remover comentário `(cast until pnpm db:types runs post-migration)` dos 5 arquivos listados em #1
- Remover o eslint-disable `@typescript-eslint/no-explicit-any` em `submitWord.ts` e `wordcloud.ts`
- Adicionar coverage threshold no vitest config (≥85% nas pastas `lib/wordcloud`, `hooks`, `server-actions`)
- Verificar/corrigir o pre-existente `pnpm lint` que quebra em Next 16 (`next lint --max-warnings 0` flag deprecada) — não relacionado à wordcloud mas vai bloquear CI

## 5. Roadmap maior (não wordcloud — adiar)

### Sistema multi-slide (Mentimeter/AhaSlides-style)

Transformar `events.wordcloud_active` (1 toggle) em sistema de N slides ordenados. Plano completo já documentado no plan file (`/Users/davialves/.claude/plans/eager-doodling-feather.md` seção "Fase 2.1").

Pontos chave quando for fazer:
- Migration aditiva primeiro (slides table). NÃO remover `wordcloud_active` ainda — backfill cria slide `wordcloud` pra eventos que estavam ativos.
- `useActiveSlide` substitui `useWordcloudActive`.
- `ActiveSlideInput` (audience) / `ActiveSlideDisplay` (telão) roteiam por tipo.
- Migration final remove `events.wordcloud_active` e `events.wordcloud_config` após release estável.

### QR Code slide

Slide dedicado com QR gigante + URL + nome do evento + texto custom. Usa `qrcode.react` (já no projeto).

### Background customizável

Tipos: none / color / gradient / image. Upload pra Supabase Storage. Aplicar só em `browser_source` e `desktop_app` (H2R e Chrome PiP precisam transparente).

### Outros tipos de slide (em ordem sugerida)

`poll` → `rating` → `open_ended` → `qa` (Slido-style) → `ranking` → `quiz_select` → `quiz_type` → `brainstorm` → `image_choice` → `spinner` → `hundred_points` → `guess_number` → `two_by_two_grid` → `pin_on_image`.

### Polish / quality of life

- Live preview no operator
- Histórico de slides passados (timeline do evento)
- Export de resultados (CSV/PNG)
- Slide de intervalo com countdown
- Themes premium de wordcloud (paletas curadas, fonts diferentes)
- AI grouping em open_ended/brainstorm (embeddings)

### Refactor da página única do telão pro modelo "deck"

URL `/telao/<slug>/<slide_id>?` opcional, botões próximo/anterior no operator, animação de transição.

## Como manter este doc atualizado

Quando uma das pendências for resolvida, mover ela pro CHANGELOG (ou criar um) e remover daqui. Não deixar acumular.
