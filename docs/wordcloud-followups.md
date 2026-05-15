# Wordcloud — Follow-ups e Roadmap

Status pós-sessão de 2026-05-15. Itens marcados ✅ já foram shipados.

## 1. Migrations em produção ✅ APLICADAS

`supabase db push` aplicou 00330000 + 00340000 em `ogfalobvfofcrazaeydr`. Tipos regenerados, casts temporários removidos.

## 2. Contador de "pessoas online" ✅ SHIPADO

- `apps/web/hooks/useOnlinePresence.ts` (telão)
- `apps/web/hooks/usePresenceJoin.ts` (audiência, clientId estável em localStorage)
- `apps/web/components/telao/OnlineBadge.tsx`
- Wire em `TelaoWordcloudSwitcher` + `AudienceInputSwitcher` no canal `presence:event:<eventId>`

Cobertura: 16 testes dedicados, 193 testes no total.

## 3. UX "tudo dentro da aba Nuvem" ✅ SHIPADO

Aba Nuvem agora tem:
- ShareCard (link público + QR)
- 2 links distintos de telão: `?mode=browser_source` (transparente, OBS) e `?mode=fullscreen` (com fundo, projetor)
- Pergunta editável
- Plano de fundo: transparente / cor sólida / gradiente (color pickers nativos)
- Filtros + max-words
- Preview embutido (iframe 16:9) quando ativa
- Reset / zerar

`WordcloudConfig.background` (tagged union) persiste em `events.wordcloud_config` jsonb — sem migration nova.

## 4. Desktop app Mac ✅ BUILD + RELEASE PARCIAL

- aarch64 + x64 DMGs buildados (Tauri 2.11 + Rust 1.95)
- GitHub Release `v0.1.0` publicada com os 2 DMGs
- **Bloqueio:** repo é **PRIVADO** → links `releases/latest/download/...` dão 404 pra qualquer não-colaborador. Solução pendente:
  - **(a)** Tornar o repo público (decisão do Davi)
  - **(b)** Hospedar DMGs em Supabase Storage bucket público `desktop-releases` (autorização pendente)
  - **(c)** Criar `/api/desktop/[platform]` que faz proxy autenticado dos releases (precisa `GITHUB_TOKEN` no Vercel)
- Windows build pendente — precisa GitHub Actions matrix (macOS runner não cross-compila pra Windows trivialmente)
- Auto-update via Tauri updater não wirado

## 5. Habilitar specs E2E (Playwright)

Após qualquer mudança grande na nuvem rodar:
1. Seedar evento de teste via service-role
2. Salvar `apps/web/e2e/.auth/operator.json` via `playwright codegen`
3. Remover `.skip` de `wordcloud-flow.spec.ts` e `wordcloud-visual.spec.ts`
4. Adicionar `webServer` block ao `playwright.config.ts` pra subir `pnpm dev` automaticamente

Adicionar cobertura E2E pra:
- Toggle ON/OFF + audience UI swap
- Submit de palavra e aparição no telão dentro de ~3s
- Trocar background e ver no preview
- 3 audience contexts → badge mostra 3 → fechar 1 → vira 2

## 6. Limpezas / dívidas técnicas

- `pnpm lint` quebra em Next 16 (`next lint --max-warnings 0` flag deprecada) — não relacionado à nuvem mas precisa de fix
- Adicionar coverage threshold no vitest config (≥85% nas pastas `lib/wordcloud`, `hooks`, `server-actions`)
- `desktop-release.yml` foi mantido mas hoje está sem trigger funcional — alinhar com release flow real

## 7. Roadmap maior (não wordcloud — adiar)

### Sistema multi-slide (Mentimeter/AhaSlides-style)

Transformar `events.wordcloud_active` (1 toggle) em sistema de N slides ordenados. Plano completo em `/Users/davialves/.claude/plans/eager-doodling-feather.md` seção "Fase 2.1".

Migração aditiva primeiro (slides table). NÃO remover `wordcloud_active` ainda — backfill cria slide `wordcloud` pra eventos que estavam ativos. `useActiveSlide` substitui `useWordcloudActive`. `ActiveSlideInput` (audience) / `ActiveSlideDisplay` (telão) roteiam por tipo. Migration final remove `events.wordcloud_active/_config` após release estável.

### QR Code slide

Slide dedicado com QR gigante + URL + nome do evento + texto custom. Usa `qrcode.react` (já no projeto).

### Background avançado

Adicionar tipo `image` (upload pra Supabase Storage). Aplicar só em `fullscreen` / `desktop_app` (H2R, Browser Source e Chrome PiP precisam transparente).

### Outros tipos de slide (em ordem sugerida)

`poll` → `rating` → `open_ended` → `qa` (Slido-style) → `ranking` → `quiz_select` → `quiz_type` → `brainstorm` → `image_choice` → `spinner` → `hundred_points` → `guess_number` → `two_by_two_grid` → `pin_on_image`.

### Polish / quality of life

- Histórico de slides passados (timeline do evento)
- Export de resultados (CSV/PNG)
- Slide de intervalo com countdown
- Themes premium de wordcloud (paletas curadas, fonts diferentes)
- AI grouping em open_ended/brainstorm (embeddings)

### Refactor da página única do telão pro modelo "deck"

URL `/telao/<slug>/<slide_id>?` opcional, botões próximo/anterior no operator, animação de transição.

## Como manter este doc atualizado

Quando uma das pendências for resolvida, mover ela pro CHANGELOG (ou criar um) e remover daqui. Não deixar acumular.
