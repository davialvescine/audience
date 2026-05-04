# Plano completo — Audit + roadmap (2026-05-04)

Consolidação da auditoria de hoje + sugestões anteriores. Organizado em 5 fases com prioridade, esforço e dependências. Ordem visa: **estabilizar → polir UX de evento ao vivo → completar features na metade → entregar último modo (desktop)**.

---

## Fase 0 — Hot fixes (2–3h, hoje/amanhã)

Itens curtos que destravam ou fecham gaps críticos. Não bloqueiam features.

| # | Item | Arquivo | Risco | Esforço |
|---|------|---------|-------|---------|
| 0.1 | Corrigir `AUDIENCE_API_URL` default (hoje aponta pra `audience.app` inexistente) | `packages/h2r-bridge/src/api.ts:1` | Bridge CLI quebrado pra novos usuários | 5 min |
| 0.2 | Rodar `pnpm db:types` e remover `(supabase as any).rpc(...)` | `apps/web/server-actions/submitComment.ts:26` | Type-safety perdida | 10 min |
| 0.3 | Limpar `console.debug` de produção em TelaoClient/ModerationQueue | múltiplos | Ruído em logs | 15 min |
| 0.4 | Confirmar deploy do drag + `httpSend` + 1920×1080 stage | git + Vercel | Mudanças de hoje ainda não em prod | 10 min |

---

## Fase 1 — Confiabilidade & segurança (Sprint 1, semana 1)

**Objetivo:** matar bugs que podem destruir um evento ao vivo. Nada de UX nova até esses fecharem.

### 1.1 RLS gap — vazamento entre tenants 🔴 CRÍTICO
- **Problema:** `submissions_telao_public_read` (`supabase/migrations/00120000_telao_modes.sql:58`) permite `anon` ler `submissions where status='sent'` de **qualquer evento**.
- **Fix:** substituir policy por RPC `get_public_submissions_by_slug(slug)` que retorna só rows do evento certo. Nova migration `00150000_telao_public_rpc.sql`.
- **Esforço:** 1h.

### 1.2 Race em `claim_submission_for_send` 🔴 CRÍTICO
- **Problema:** `select` sem `for update` antes do `update` — dois operadores aprovando = dupla entrega ao H2R.
- **Fix:** refatorar pra `update ... where status='pending' and id=$1 returning *` único. Nova migration.
- **Arquivo:** `supabase/migrations/00060000_moderation_rpcs.sql:20-32`.
- **Esforço:** 30 min.

### 1.3 Investigar CHANNEL_ERROR no receiver 🟠 ALTO
- **Sintoma:** sender via `httpSend()` funciona (resolvido hoje), mas WebSocket subscribe ainda dá CHANNEL_ERROR.
- **Hipóteses:**
  - JWT do anon-key não autorizado pra `replica identity full` + policy restritiva
  - Realtime authorization mode no projeto Supabase
- **Plan:** abrir Realtime logs no Supabase Dashboard, verificar erro real do gateway, ajustar policy de `realtime.messages` se necessário.
- **Esforço:** 1–2h (investigação).

### 1.4 Status do Realtime na UI 🟠 ALTO
- **Onde:** badge no header das abas Moderação e Telão da admin: `🟢 Ao vivo / 🟡 Reconectando / 🔴 Offline (polling)`.
- **Como:** estado derivado dos callbacks de `subscribe()` + heartbeat de polling.
- **Esforço:** 1h.

### 1.5 Autosave race protection 🟡 MÉDIO
- **Problema:** mudanças rápidas (drag) podem ter requisições in-flight que escrevem versão antiga sobre nova.
- **Fix:** AbortController + monotonic version counter; descarta resposta se versão ≠ atual.
- **Arquivo:** `apps/web/components/audience/TelaoTab.tsx:114-138`.
- **Esforço:** 45 min.

### 1.6 Sentry config robusta 🟡 MÉDIO
- Adicionar `Sentry.setTag('event_slug', slug)` em moderação.
- Capturar exceptions em `deliverToH2R` falhas (`apps/web/server-actions/moderation.ts:74-78`).
- Replay sample em produção.
- `before_send` filtrando PII (nome do usuário em comentários).
- **Esforço:** 1h.

### 1.7 Rate limit por IP-hash 🟡 MÉDIO
- **Problema:** redes com NAT (igreja inteira atrás de 1 IP) → 5/60s bloqueia geral.
- **Fix:** combinar IP + fingerprint (User-Agent + `x-vercel-forwarded-for`) ou aumentar limite contextual + index em `submissions(ip_hash, created_at)`.
- **Esforço:** 1h.

### 1.8 Flush queue blocking timeout 🟢 BAIXO (não bloqueia)
- **Problema:** loop com `await sleep(intervalMs)` em server action pode estourar 10s/60s do Vercel.
- **Fix:** mover pra `/api/cron` ou Edge Function com background.
- **Arquivo:** `apps/web/server-actions/moderation.ts:124-191`.
- **Esforço:** 2h. Adiar pra Sprint 2 se não der tempo.

**Total Sprint 1:** ~7–9h de trabalho concentrado.

---

## Fase 2 — UX do operador no evento ao vivo (Sprint 2, semana 2)

**Objetivo:** que evento de 200 mensagens seja moderável sem fricção. Tudo que reduz cliques e elimina erros.

### 2.1 Atalhos de teclado na moderação 🟠
- `J` / `K` navegar (próximo/anterior).
- `A` aprovar, `R` rejeitar, `U` desfazer último.
- `Espaço` mostrar próximo no telão (manual override — depende de 2.6).
- Foco visível na card ativa (ring + scroll-into-view).
- **Esforço:** 2h.

### 2.2 Undo de aprovar/rejeitar 🟠
- Toast com "Desfazer" 5s depois de cada ação.
- Implementar como reversão: rejeitar → pending; aprovar → pending (apenas se ainda não foi enviado).
- **Esforço:** 1.5h.

### 2.3 Filtros + busca na queue 🟠
- Tabs ou pills: `Pendente / Aprovado / Falha / Tudo`.
- Input de busca por nome (debounced).
- Contador em cada filtro.
- **Esforço:** 1h.

### 2.4 Mini-preview do card no SubmissionCard 🟡
- No card de moderação, render miniatura de como vai sair no telão (~30% do tamanho real).
- Mostra tipografia/cores aplicadas ao comentário em questão.
- **Esforço:** 1.5h.

### 2.5 Notificação sonora + título da aba + badge de fila 🟡
- Beep opcional (toggle nas settings) ao chegar pendente novo.
- Title: `(3) Audience — Evento X` quando há pendentes.
- Badge persistente no header da admin (sempre visível, não só na tab Moderação): `🔴 12 pendentes` com cor que muda conforme volume (verde 0, amarelo 1–10, vermelho 10+).
- **Esforço:** 1h.

### 2.6 Controles manuais da fila 🟡
- Botões na admin: `⏸ Pausar fila`, `⏭ Próximo agora`, `🗑 Limpar fila`.
- RPC `pause_event_queue(eventId)` que para o flush worker.
- **Esforço:** 2h.

### 2.7 `isOnline` recalculado no cliente 🟡
- Hoje é server-side em `app/admin/events/[slug]/page.tsx:49-52`, congela até refresh.
- Tick a cada 10s no cliente comparando `last_heartbeat` com `now()`.
- **Esforço:** 30 min.

### 2.8 Settings tab funcional 🟢
- Hoje é placeholder. Mínimo: pausar submissões, renomear evento, exportar CSV de submissions, deletar com confirm.
- **Esforço:** 2h.

### 2.9 Link de moderador sem login 🟠 (nova feature)
- **Caso de uso:** dono do evento envia link pro voluntário (WhatsApp/Telegram) e ele modera de qualquer celular sem cadastro.
- **Design:**
  - Tabela `moderator_tokens` (`event_id`, `token`, `expires_at`, `created_by`, `revoked_at`, `display_name?`).
  - Token = 32 bytes random base64url.
  - Rota `/m/[token]` (não autenticada): valida token, monta sessão temporária via cookie HTTP-only ou claim em URL.
  - RPC `moderate_with_token(token, submission_id, action)` security-definer faz a validação ao invés de RLS por `auth.uid()`.
  - Audit: `submissions.moderated_by_token = token_id` quando ação veio via link.
- **UI:**
  - Aba Settings tem botão "Gerar link de moderador" → mostra URL + botão copiar + botão revogar.
  - Lista tokens ativos com último uso e quem usou (se nome foi capturado).
  - Página `/m/[token]` é a `ModerationQueue` simplificada, sem nav admin (mobile-first).
- **Segurança:**
  - Token só dá acesso a APROVAR/REJEITAR de UM evento específico. Sem leitura de outros recursos.
  - Rate limit por token (não só IP).
  - Expiração default 24h, configurável até fim do evento.
  - Revogação imediata via flag `revoked_at`.
- **Esforço:** 6–8h (migration + RPC + rota + UI + testes RLS).

**Total Sprint 2:** ~17–19h (foi expandido — pode dividir em S2a e S2b).

---

## Fase 3 — Per-mode configs + drag refinements (Sprint 3, semana 3)

**Objetivo:** terminar a feature de config que está 50% (schema sem código) + polir a experiência de drag.

### 3.1 Per-mode configs UI 🟠
- **Schema já existe:** `events.telao_configs jsonb` (`00130000_per_mode_configs.sql`). Zero código lê.
- **UI:** seletor "Configurando: [H2R / Browser Source / Chrome PiP / Desktop]" no topo da TelaoTab.
- **Comportamento:** edita `telao_configs[mode]` com fallback ao `telao_config` global se vazio. Botão "Copiar do global".
- **Server action:** `updateTelaoConfigForMode(eventId, mode, config)`.
- **Display:** `app/telao/[slug]/page.tsx` lê `?mode=` do query e escolhe `configs[mode] ?? config`.
- **Esforço:** 4h.

### 3.2 Snap-to-grid + snap-to-edge no drag 🟡
- Threshold ~3% do palco.
- Snap em: 0/25/50/75/100% (X e Y), bordas (5% padding), centro do eixo oposto.
- Indicador visual: linha vertical/horizontal aparece quando snapping.
- **Arquivo:** `apps/web/components/telao/TelaoClient.tsx:onPointerMove`.
- **Esforço:** 1.5h.

### 3.3 Coordenadas live durante drag 🟢
- Overlay flutuante: `X: 80% · Y: 12%` no canto do preview enquanto arrasta.
- **Esforço:** 30 min.

### 3.4 Preview de animação automático ao trocar 🟢
- Mudança em `config.animation` dispara auto `telao-play-cycle`.
- **Esforço:** 15 min.

### 3.5 Toggle de exemplo de texto 🟢
- Botão "Trocar exemplo" alterna entre nome+comentário curto / médio / longo / com emoji.
- Útil pra ver como o card se comporta.
- **Esforço:** 30 min.

### 3.6 Decisão sobre `posXPct/posYPct` em per-mode 🟡
- Drag-position deve ser per-mode também? Provavelmente sim — H2R tem grafismo diferente, posição muda.
- Confirma após 3.1.
- **Esforço:** incluído em 3.1.

**Total Sprint 3:** ~7h.

---

## Fase 4 — Audience Desktop App MVP (Sprint 4, semana 4)

**Objetivo:** entregar o último modo. Tauri + webview transparent + always-on-top. Distribuição unsigned (sem Apple Developer $99).

### 4.1 Scaffold Tauri 2 em `apps/desktop` 🟠
- `cargo install tauri-cli` (Rust já instalado).
- Estrutura: workspace pnpm + cargo.
- Comandos básicos: `pnpm desktop:dev` / `pnpm desktop:build`.
- **Esforço:** 1.5h.

### 4.2 Webview config 🟠
- Janela: frameless, transparent, always-on-top, click-through opcional via shortcut.
- URL: `https://audience-opal.vercel.app/telao/[slug]?mode=desktop_app`.
- Tamanho default: tela inteira.
- **Esforço:** 2h.

### 4.3 Login/pareamento 🟠
- Reusar invitation system: usuário cola token na primeira vez.
- Token persistido em config local Tauri.
- **Esforço:** 1.5h.

### 4.4 Auto-update 🟡
- Tauri updater apontando pra release no GitHub.
- Sem signing (warning na primeira execução, doc explica).
- **Esforço:** 1.5h.

### 4.5 Página de download na admin 🟡
- Substituir placeholder em `TelaoTab.tsx:240-243` por:
  - Detectar OS, link direto pro `.dmg` / `.exe` / `.AppImage`.
  - Instruções de "primeira execução em Mac" (controle+abrir).
- **Esforço:** 1h.

### 4.6 Smoke test em Mac + Windows 🟡
- Build, distribuir, rodar evento de teste.
- **Esforço:** 1h.

**Total Sprint 4:** ~8.5h.

---

## Fase 5 — Polish & long tail (backlog)

Itens menores, ordem flexível, fazer entre sprints ou quando der tempo.

### Card visual
- **Avatar/iniciais** — `showAvatar` field existe no config mas não é usado. Renderizar círculo com iniciais quando ativado.
- **Background image** opcional no card (pra branding de evento).
- **Theme presets** — botões "Casual / Corporate / Gospel / Dark" que carregam combinações de cores+fontes.

### Audiência (pessoa enviando comentário)
- **Contador de caracteres** em `SubmissionForm.tsx`.
- **Animação de confirmação** após submit (já manda, mas falta feedback visual).
- **Estimativa de fila** ("Você é o 5º na fila").

### Telão display
- **Múltiplos cards lado-a-lado** (hoje só vertical via `maxConcurrent`).
- **Layout horizontal** opcional (cards rolando como ticker no rodapé).

### Bridge CLI
- **Reconexão automática** se Cloudflared cair (`packages/h2r-bridge/src/cloudflared.ts`).
- **Retry com backoff** no heartbeat (`api.ts:21` ignora errors).
- **Logs estruturados** (hoje é só `console.log`).

### Tech debt
- **Substituir JSON.stringify dirty-check** em autosave por shallow-equal.
- **Reduzir key massivo de `motion.div`** (`TelaoClient.tsx:308`) — isolar em `m.id` apenas.
- **Helper `getEnv()`** com early throw em vez de `process.env.X!` espalhado.
- **Remover Tailwind classes dinâmicas** que JIT não pega (revisar tudo).
- **Index em `submissions(ip_hash, created_at)`** pra rate limit.
- **Página `/admin/ui-kit/page.tsx`** — se for showcase, mover pra rota gated por env.

### Observability
- Painel admin com métricas do evento: total enviado, taxa de aprovação, latência média até telão.
- Webhook de saúde pro operador (Slack/Discord) quando evento começa/termina.

### Tests
- E2E Playwright pra fluxo completo (audiência → moderação → telão).
- Testes de RPCs contra Supabase local.
- Smoke test de migrations no CI.

---

## Cronograma agregado

| Sprint | Foco | Esforço | Dependências |
|--------|------|---------|--------------|
| Fase 0 | Hot fixes | 2–3h | nenhuma |
| Sprint 1 | Confiabilidade | 7–9h | Fase 0 |
| Sprint 2 | UX live + link moderador | 17–19h | Sprint 1 (precisa Realtime estável) |
| Sprint 3 | Per-mode + drag | 7h | nenhuma estrita, mas faz sentido após S2 |
| Sprint 4 | Desktop App | 8.5h | nenhuma estrita |
| Backlog | Polish | conforme | depende de qual item |

**Total estimado: 41–48h de trabalho focado** distribuído em 4 semanas (Sprint 2 expandiu com link de moderador).

---

## Critérios de "pronto" (definition of done)

Cada item só fecha quando:
1. ✅ Funciona em dev local
2. ✅ Tem teste se for lógica não-trivial (RLS, RPCs, validators)
3. ✅ Build passa (`pnpm build`)
4. ✅ Typecheck passa (`pnpm typecheck`)
5. ✅ Lint passa
6. ✅ Commit com mensagem descritiva apontando o "porquê"
7. ✅ Push pra main = deploy Vercel
8. ✅ Smoke test em prod (1 evento de teste com link `/e/[slug]`)

---

## Decisões abertas

Antes de começar, vale alinhar:

1. **Realtime vs polling como source-of-truth?** Hoje belt-and-suspenders. Se Realtime ficar estável depois de S1, pode reduzir polling pra 30s+.
2. **Per-mode configs override total ou parcial?** Override só de campos preenchidos (deep merge) ou substituição total do config?
3. **Audience Desktop App: signing?** Continuamos unsigned mesmo? Vale notar que macOS Sequoia (15+) pode bloquear apps unsigned mais agressivamente.
4. **Ordem real de prioridade**: confirma que confiabilidade > UX > features. Se quiser Desktop App primeiro (visibilidade), reordenamos.
5. **Pretende lançar pra outros usuários (multi-tenant real) em quanto tempo?** Isso muda peso do RLS gap (Fase 1.1).

Me diz qual item começa.
