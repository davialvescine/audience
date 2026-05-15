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

### Esboço de implementação (TDD)

**Files:**
- `apps/web/hooks/useOnlinePresence.ts` — recebe `eventId`, retorna `{ count, isConnected }`. No telão monta um canal Realtime de **Presence** (não postgres_changes), faz `track({})` opcional, escuta `sync` e conta as presenças.
- `apps/web/hooks/usePresenceJoin.ts` — usado pela audiência. Apenas faz `track({ joinedAt: Date.now() })` no mesmo canal pra contar como presente. Untrack no unmount.
- `apps/web/components/telao/OnlineBadge.tsx` — pill flutuante no canto top-right do stage, fundo translúcido, ícone de pessoa, número grande.
- Integrar no `WordCloudDisplay` e no `AudienceInputSwitcher`.

**Testes:**
- Property: `count >= 0` sempre.
- Unit: hook conta presenças quando `sync` dispara com N entradas.
- E2E (junto com wordcloud-flow): abre 3 contexts de audiência, telão mostra "3 online", fecha 1, mostra "2 online".

**Tradeoffs:**
- Supabase Presence é "lossy" — pode atrasar uns segundos. Aceitável pra essa UX.
- Cada conexão conta — se um celular abre 2 abas, conta 2. Resolver com client_id estável (UUID em localStorage) se virar problema.
- O canal de Presence pode ser compartilhado com o `events` (mesma `channel(...)`)? Provavelmente sim — economiza WS connection. Verificar com Supabase docs.

**Esforço estimado:** 1 task de hook + 1 task de componente + 1 task de wire = ~2h com TDD estrito.

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
