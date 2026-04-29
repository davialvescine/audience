# Audience → H2R Graphics Bridge — Design Spec

**Data:** 2026-04-29
**Status:** Aprovado para plano de implementação
**Autor:** Davi (com Claude)

---

## 1. Objetivo

Sistema web que permite que a audiência de um evento envie nome+comentário através de um link público, um operador modere as submissões em um painel, e os comentários aprovados sejam disparados automaticamente para o software de transmissão **H2R Graphics** rodando em outra máquina (que pode estar em qualquer rede), aparecendo no telão do evento.

**Suporte a múltiplos eventos simultâneos:** Dois eventos podem rodar ao mesmo tempo, cada um com seu link público, painel de moderação, máquina H2R conectada e tema visual próprio.

## 2. Não-objetivos (YAGNI)

- Não vamos construir editor visual de gráficos (H2R já faz isso)
- Não vamos construir analytics complexo (contadores básicos no painel bastam)
- Não vamos suportar mídia (foto/vídeo) nas submissões na v1
- Não vamos implementar cadastro de usuários final — só admin/operador tem conta
- Não vamos suportar resposta/conversa — fluxo é unidirecional (submissão → tela)

## 3. Stack

Conforme padrão do projeto (`Padrão de construção`):

- **Framework:** Next.js 15 App Router + TypeScript estrito
- **Banco / Auth / Realtime:** Supabase (Postgres + Auth + Realtime + RLS)
- **Estilização:** Tailwind CSS 3.4 com CSS variables para theming
- **Deploy app web:** Vercel
- **Bridge CLI:** Node 20+ standalone (publicado em npm como `@ucob/h2r-bridge`)
- **Tunnel embutido:** `cloudflared` (binário baixado pelo CLI ou pré-instalado)
- **Observabilidade:** Sentry (web + CLI)
- **Tests:** Vitest + Testing Library + Playwright
- **CI:** GitHub Actions
- **Monorepo:** pnpm workspaces (apps/web + packages/h2r-bridge + packages/shared-types)

## 4. Arquitetura

```
   ┌──────────────────┐                    ┌────────────────────┐
   │  Público         │                    │  Operador          │
   │  audience.app/   │                    │  audience.app/     │
   │     e/<slug>     │                    │     admin/<slug>   │
   └────────┬─────────┘                    └──────────┬─────────┘
            │ POST submissão                          │ aprovar
            ▼                                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │              Next.js (Vercel) — apps/web                    │
   │  ┌──────────────────────────────────────────────────────┐   │
   │  │  Server Actions: submitComment, approveSubmission    │   │
   │  │  API Routes: /api/pair/redeem, /api/pair/heartbeat   │   │
   │  └────────────────┬─────────────────────────────────────┘   │
   └───────────────────┼─────────────────────────────────────────┘
                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  Supabase (Postgres + Realtime + Auth)                      │
   │   • events  • submissions  • pairing_codes  • themes        │
   └─────────────────────────────────────────────────────────────┘
                       ▲
                       │ aprovação dispara
                       │ POST p/ event.h2r_webhook_url
                       ▼
   ┌──────────────────────────────────────────┐
   │  Cloudflare Tunnel (criado pelo bridge)  │
   │  https://abc-xyz.trycloudflare.com       │
   └────────────────┬─────────────────────────┘
                    ▼
   ┌──────────────────────────────────────────┐
   │  Máquina do H2R Graphics                 │
   │  ┌────────────────────────────────────┐  │
   │  │  @ucob/h2r-bridge (Node CLI)       │  │
   │  │  • Mantém cloudflared tunnel ativo │  │
   │  │  • Heartbeat para o backend        │  │
   │  └────────────────────────────────────┘  │
   │  ┌────────────────────────────────────┐  │
   │  │  H2R Graphics (desktop app)        │  │
   │  │  http://localhost:4001/data/<id>   │  │
   │  └────────────────────────────────────┘  │
   └──────────────────────────────────────────┘
```

## 5. Schema do Banco

### Tabela `themes`
Catálogo de temas visuais reutilizáveis.

| coluna | tipo | constraint |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | UNIQUE, NOT NULL |
| `name` | text | NOT NULL |
| `tokens` | jsonb | NOT NULL — paleta + fontes + radius |
| `created_at` | timestamptz | default now() |

Seed inicial: `geracao-2026` com paleta da imagem TELÃO.jpg.

### Tabela `events`

| coluna | tipo | constraint |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | UNIQUE, NOT NULL — usado em URL pública |
| `name` | text | NOT NULL |
| `owner_id` | uuid | FK auth.users, NOT NULL |
| `theme_id` | uuid | FK themes, NOT NULL |
| `h2r_webhook_url` | text | nullable até pareamento |
| `h2r_source_id` | text | nullable até pareamento |
| `h2r_paired_at` | timestamptz | nullable |
| `h2r_last_heartbeat` | timestamptz | nullable — atualizado pelo CLI |
| `submissions_open` | boolean | default true — operador pode pausar |
| `created_at` | timestamptz | default now() |

**RLS:**
- `SELECT`: público pode ver `(slug, name, theme_id, submissions_open)` por slug; owner vê tudo
- `INSERT/UPDATE/DELETE`: apenas owner

### Tabela `submissions`

| coluna | tipo | constraint |
|---|---|---|
| `id` | uuid | PK |
| `event_id` | uuid | FK events, NOT NULL |
| `name` | text | NOT NULL, length 1–60 |
| `comment` | text | NOT NULL, length 1–280 |
| `status` | enum | `pending` / `approved` / `rejected` / `sent` / `failed` |
| `ip_hash` | text | hash sha256 do IP+salt — anti-spam |
| `created_at` | timestamptz | default now() |
| `approved_at` | timestamptz | nullable |
| `sent_at` | timestamptz | nullable |
| `error_message` | text | nullable se status=failed |

**RLS:**
- `INSERT`: público (anon) só via RPC `submit_comment` com rate limit (5/min/ip)
- `SELECT/UPDATE`: apenas owner do evento

### Tabela `pairing_codes`

| coluna | tipo | constraint |
|---|---|---|
| `code` | text | PK, formato `AUDIENCE-XXXX-XXXX` (8 chars alfanuméricos = ~2.8 trilhões de combinações) |
| `event_id` | uuid | FK events, NOT NULL |
| `expires_at` | timestamptz | NOT NULL — 15 min após criar |
| `consumed_at` | timestamptz | nullable — uma vez só |

**RLS:**
- `INSERT/SELECT`: apenas owner do evento (gerar código)
- O endpoint `/api/pair/redeem` usa service role para validar/consumir (CLI não tem auth de usuário)

## 6. Rotas e Server Actions

### Públicas
| Rota | Tipo | Descrição |
|---|---|---|
| `/` | page | Landing simples (link pra "Criar evento" se logado) |
| `/e/[slug]` | page (Server Component) | Form público mobile-first com tema do evento |
| `/e/[slug]/obrigado` | page | Confirmação após envio |

### Admin (auth required)
| Rota | Tipo | Descrição |
|---|---|---|
| `/admin` | page | Login magic-link |
| `/admin/events` | page | Lista de eventos do owner |
| `/admin/events/new` | page | Wizard: nome, slug, tema, parear H2R |
| `/admin/events/[slug]` | page | **Fila de moderação realtime** |
| `/admin/events/[slug]/settings` | page | Tema, webhook (re-parear), pause |

### Server Actions
- `submitComment(slug, name, comment)` — chama RPC `submit_comment`, retorna ok/error
- `approveSubmission(submissionId)` — owner-only; valida; dispara H2R; atualiza status
- `rejectSubmission(submissionId)` — owner-only
- `createEvent(name, slug, themeId)` — auth required
- `generatePairingCode(eventId)` — owner-only; cria/retorna código

### API Routes (para o CLI, sem auth de usuário)
- `POST /api/pair/redeem` — body `{code, tunnel_url, source_id}` → valida, salva, retorna `{event_id, event_name}`
- `POST /api/pair/heartbeat` — body `{event_id, secret}` → atualiza `h2r_last_heartbeat`

## 7. Sistema de Theming

**Princípio:** trocar cores pra próximo evento = criar 1 arquivo + escolher no painel. Zero código de UI mexido.

### `lib/design-tokens.ts`
```ts
export type ThemeTokens = {
  colors: {
    primary: string;
    primaryDeep: string;
    accent: string;
    secondary: string;
    ink: string;
    paper: string;
    surface: string;
    success: string;
    danger: string;
  };
  radius: { sm: string; md: string; lg: string };
  font: { sans: string; display: string };
};
```

### `lib/themes/geracao-2026.ts`
```ts
export const geracao2026: ThemeTokens = {
  colors: {
    primary: '#0E4C5E',
    primaryDeep: '#0A2C3D',
    accent: '#F5C518',
    secondary: '#6E45B6',
    ink: '#0A2540',
    paper: '#FFFFFF',
    surface: '#F8FAFC',
    success: '#10B981',
    danger: '#EF4444',
  },
  radius: { sm: '0.375rem', md: '0.75rem', lg: '1.25rem' },
  font: { sans: 'Inter, system-ui, sans-serif', display: 'Inter, system-ui, sans-serif' },
};
```

### `<ThemeProvider>` (client component)
Recebe `theme: ThemeTokens` (vindo de `event.theme.tokens` no DB), injeta CSS vars no `<html>`:
```css
:root {
  --color-primary: #0E4C5E;
  --color-accent: #F5C518;
  /* ... */
}
```

### Tailwind config
Mapeia tokens via `theme.extend.colors`:
```ts
colors: {
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  // ...
}
```

Usar `bg-primary`, `text-accent`, etc. em todos componentes. **Proibido usar Tailwind palette literal** (`bg-blue-500`, `text-yellow-400`) em qualquer lugar exceto componentes do design system. ESLint custom rule + code review enforça.

### Trocar tema = trocar evento
1. Criar `lib/themes/<novo-evento>.ts`
2. Insert na tabela `themes` (slug + tokens jsonb)
3. Em `/admin/events/new` ou `/settings`, escolher tema
4. Pronto

## 8. Componentização

### `components/ui/` — primitivos do design system
- `Button` — variants `primary` / `accent` / `ghost` / `danger`; sizes `sm`/`md`/`lg`
- `Input`, `Textarea` — com label, error state, helper text, conta caracteres
- `Card`
- `Badge` — variants `pending`/`approved`/`rejected`/`sent`/`failed`
- `EmptyState` — ícone + título + texto + CTA opcional
- `LoadingSkeleton`
- `ErrorBoundary` — loga em Sentry, mostra fallback
- `BrandHeader` — gradiente `from-primary to-accent`, suporta logo
- `ThemeProvider`

### `components/audience/` — feature-specific
- `SubmissionForm` — form público
- `SubmissionCard` — card individual no painel
- `ModerationQueue` — lista realtime com filtros (pending/all)
- `ModerationActionBar` — Aprovar/Rejeitar/Refazer
- `PairingCodeDisplay` — mostra código + comando `npx`, status conexão
- `EventSettingsForm`

### `components/layout/`
- `PageContainer`, `AdminShell`

### Rota `/admin/ui-kit` (admin-only)
Mostra todos componentes em estados (default/hover/loading/error/empty). Substitui Storybook enquanto biblioteca < 15 componentes.

### Padrões obrigatórios (do padrão de construção)
- Toda lista renderiza `<EmptyState>` quando vazia
- Toda fetch tem `<LoadingSkeleton>` enquanto carrega
- Layouts críticos têm `<ErrorBoundary>`
- Mobile-first; teste em viewport 375px primeiro

## 9. Bridge CLI — `@ucob/h2r-bridge`

Pacote Node publicado em npm. Usuário roda `npx`, sem instalação global.

### Comandos
```
npx @ucob/h2r-bridge pair <CODIGO>
```

### Fluxo do `pair`
1. Valida formato do código (`AUDIENCE-XXXX-XXXX`)
2. Pergunta source-id da H2R Listener (com link pras docs)
   - Tenta auto-detectar: `GET http://localhost:4001/projects` (se H2R expõe)
   - Fallback: prompt manual
3. Verifica se `cloudflared` está disponível; se não, baixa o binário oficial pra `~/.ucob-h2r-bridge/`
4. Spawn `cloudflared tunnel --url http://localhost:4001`
5. Faz parsing do stdout até capturar URL `https://*.trycloudflare.com`
6. Constrói webhook URL: `${tunnel_url}/data/${source_id}`
7. Faz teste local: `POST http://localhost:4001/data/${source_id}` com payload de health check
8. `POST /api/pair/redeem` com `{code, tunnel_url, source_id}`
9. Recebe `{event_id, event_name, heartbeat_secret}` — salva em `~/.ucob-h2r-bridge/state.json`
10. Imprime confirmação visual: ✅ Conectado ao evento "<name>"
11. Loop de heartbeat (a cada 30s) pra `/api/pair/heartbeat` enquanto cloudflared estiver vivo
12. Trap SIGINT → mata cloudflared, para de heartbeatar. **Não** zera `paired_at` no banco (state preservado para `resume`). Painel detecta offline via heartbeat stale > 90s e mostra badge "🔴 Bridge offline" — operador pode mesmo assim aprovar; falhas vão pra status `failed`.

### State persistido
`~/.ucob-h2r-bridge/state.json`:
```json
{
  "event_id": "uuid",
  "event_name": "O Nascer de Uma Geração",
  "tunnel_url": "https://abc-xyz.trycloudflare.com",
  "source_id": "UXKIOKQJAA",
  "heartbeat_secret": "..."
}
```

Comando extra: `npx @ucob/h2r-bridge resume` — re-conecta sem precisar de novo código.

### Testes
- Unit: parser de stdout do cloudflared, validação de payload
- Integration: subir mock do H2R + servidor fake, rodar `pair` end-to-end

## 10. Fluxo de Aprovação (detalhado)

```
1. Operador clica "Aprovar" no painel
2. Server Action approveSubmission(id):
   a. Carrega submission + event (RLS valida ownership)
   b. Se submission.status !== 'pending' → erro idempotente
   c. UPDATE submission SET status='approved', approved_at=now()
   d. Constrói payload H2R:
      {
        messages: [{
          id: submission.id,                          // já é uuid único
          timestamp: Math.floor(Date.now() / 1000),
          snippet: { displayMessage: submission.comment },
          authorDetails: {
            displayName: submission.name,
            profileImageUrl: ''                       // sem avatar na v1
          },
          platform: {
            name: event.name,
            logoUrl: ''                               // futuro
          }
        }]
      }
   e. fetch(event.h2r_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
   f. Se 2xx: UPDATE submission SET status='sent', sent_at=now()
   g. Se erro: UPDATE submission SET status='failed', error_message=...
3. Realtime atualiza painel automaticamente
```

**Idempotência:** botão "Aprovar" desabilitado se status !== 'pending'. Repetir aprovação não duplica POST (early return em `b`).

**Retry:** se falhar, painel mostra status `failed` + botão "Tentar novamente" → re-executa server action que faz novo POST.

## 11. Segurança

- **RLS Postgres** cobre todo acesso a dados — sem proteção em código de aplicação como única defesa
- **Rate limit** público: RPC `submit_comment` checa `ip_hash` últimos 60s (5 req max). Implementado em PL/pgSQL
- **Pairing code:** 8 caracteres alfanuméricos (≈2.8 trilhões de combinações), TTL 15 min, one-time consume → resistente a brute force
- **Heartbeat secret:** 32-byte random gerado server-side no redeem → sem auth de user no CLI mas só esse secret libera heartbeat
- **Webhook URL guardada como secret:** RLS impede que público leia `events.h2r_webhook_url`. Só owner.
- **Sanitização:** `name` e `comment` strip HTML, validate length, reject zero-width chars
- **Sentry** com tags `event_id` mas **sem PII** em logs (não logar comment text)
- **CORS** form público: nenhum, só same-origin
- **CSP** estrito em rotas admin

## 12. Observabilidade

- **Sentry** ambos no web e no CLI
- Tags Sentry: `event_id`, `event_slug`, `submission_id`, `version`
- Métricas custom (Vercel Analytics ou tabela `metrics`):
  - submissions/min por evento
  - approval rate
  - H2R failure rate
  - Bridge heartbeat status
- Logs estruturados (Pino) — JSON em prod
- Dashboard simples no painel admin: "últimas 24h: 250 enviados, 180 aprovados, 5 falhas H2R"

## 13. Estratégia de Testes (TDD)

### `apps/web`
- **Unit (Vitest)**:
  - Validators de payload (zod schemas)
  - Builder de payload H2R
  - Helper de tema (CSS var generation)
  - Sanitização de input
- **Integration (Vitest + Supabase local)**:
  - RLS: 2 owners diferentes não veem submissions um do outro
  - Rate limit: 6ª request em 60s rejeitada
  - Server action `approveSubmission`: dispara fetch correto; idempotente; retry funciona
  - RPC `submit_comment`: validação de length, sanitização
- **E2E (Playwright)**:
  - Fluxo completo: criar evento → parear (com mock CLI) → submeter público → aprovar → verificar fetch H2R recebido (mock)
  - Realtime: aprovar em uma aba muda card em outra aba

### `packages/h2r-bridge`
- **Unit**: parser cloudflared, validação code, builder de URL
- **Integration**: subir mock H2R + mock backend, rodar `pair`, validar fim a fim

### CI (GitHub Actions)
- Job `lint` (ESLint + Prettier check)
- Job `typecheck` (tsc --noEmit em todos pacotes)
- Job `test-web` (Vitest com Supabase via testcontainers)
- Job `test-bridge` (Vitest)
- Job `e2e` (Playwright contra build de prod)
- Branch protection na `main` exige todos verdes

## 14. Multi-evento concorrente

Suportado por design:
- **Eventos isolados** via `slug` na URL e RLS por `owner_id`/`event_id`
- **Cada evento tem seu webhook**: dois operadores podem rodar `npx @ucob/h2r-bridge pair` simultaneamente em duas máquinas H2R diferentes — cada um com seu pairing code → cada um popula `events.h2r_webhook_url` do seu evento
- **Realtime canal por evento**: `supabase.channel('event:' + eventId)` — não há cross-talk
- **Rate limit é por IP não por evento** — anti-flood global (público mal-intencionado não consegue floodar nem 1 evento)
- **Tema por evento** — cada evento renderiza com paleta própria

Limitações conhecidas (não-bloqueantes):
- Mesmo owner pode ter N eventos, mas free tier Vercel/Supabase aguenta ~5 eventos pequenos simultâneos sem problema. Se crescer, plano paid já cobre.

## 15. Estrutura de pastas

```
Audience/
├── .github/workflows/ci.yml
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (public)/
│       │   │   ├── page.tsx                  # landing
│       │   │   └── e/[slug]/
│       │   │       ├── page.tsx              # form público
│       │   │       └── obrigado/page.tsx
│       │   ├── admin/
│       │   │   ├── page.tsx                  # login
│       │   │   ├── events/
│       │   │   │   ├── page.tsx              # lista
│       │   │   │   ├── new/page.tsx          # wizard
│       │   │   │   └── [slug]/
│       │   │   │       ├── page.tsx          # moderação
│       │   │   │       └── settings/page.tsx
│       │   │   └── ui-kit/page.tsx           # showcase
│       │   ├── api/
│       │   │   └── pair/
│       │   │       ├── redeem/route.ts
│       │   │       └── heartbeat/route.ts
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                           # design system primitives
│       │   ├── audience/                     # feature components
│       │   └── layout/
│       ├── lib/
│       │   ├── design-tokens.ts
│       │   ├── themes/
│       │   │   └── geracao-2026.ts
│       │   ├── supabase/                     # clients (browser, server, service)
│       │   ├── h2r/                          # payload builder
│       │   ├── validators/                   # zod schemas
│       │   └── sentry.ts
│       ├── server-actions/
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       └── .env.example
├── packages/
│   ├── h2r-bridge/
│   │   ├── src/
│   │   │   ├── index.ts                      # entry
│   │   │   ├── commands/
│   │   │   │   ├── pair.ts
│   │   │   │   └── resume.ts
│   │   │   ├── cloudflared.ts                # spawn + parser
│   │   │   ├── api-client.ts
│   │   │   └── state.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared-types/
│       ├── src/index.ts                      # tipos compartilhados (Theme, Submission, etc.)
│       └── package.json
├── supabase/
│   ├── migrations/                           # versioned SQL
│   ├── seed.sql
│   └── functions/                            # edge functions se precisar
├── docs/
│   ├── superpowers/specs/
│   ├── runbooks/
│   └── padrao-de-construcao.md
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

## 16. Pré-requisitos para implementação

- [ ] Conta Supabase criada (free tier)
- [ ] Projeto Vercel criado
- [ ] Conta Sentry (free tier)
- [ ] Domínio decidido (`audience.app`? subdomínio UCOB? Vercel default ok pro MVP)
- [ ] Decisão: `@ucob/h2r-bridge` ou `@audience/h2r-bridge` como nome npm

## 17. Open questions / decisões adiadas

1. **Avatar nas submissões:** v1 sem avatar (campo `profileImageUrl` = ''). Futuro pode pegar Gravatar ou upload.
2. **Logo do platform no payload H2R:** v1 vazio. Futuro: upload de logo por evento e referência URL pública via Supabase Storage.
3. **Cleanup de tunnel órfão:** se CLI morrer sem cleanup, `h2r_webhook_url` continua na tabela mas tunnel está morto. Heartbeat detecta após 90s e painel mostra "offline" (ainda permite aprovar — falhas vão pra `failed` e ficam visíveis).
4. **Resilience offline:** se Vercel cair durante evento, submissões públicas falham. Aceitável pra v1 (Vercel SLA suficiente).
5. **i18n:** v1 só pt-BR. Strings centralizadas em `lib/i18n/pt-BR.ts` pra tradução futura sem refactor.

## 18. Cronograma sugerido (estimativa solta)

- **Sprint 1 (foundation):** monorepo, CI, design system primitives, Supabase migrations, theme system. ~3 dias
- **Sprint 2 (público + admin core):** form público, login admin, lista eventos, criar evento. ~2 dias
- **Sprint 3 (moderação):** painel realtime, approve/reject, server action H2R. ~2 dias
- **Sprint 4 (bridge CLI):** package, pair flow, cloudflared spawn, heartbeat. ~3 dias
- **Sprint 5 (polimento):** tests E2E, observability, docs, runbook. ~2 dias

Total: ~12 dias úteis. PR pequeno por feature (< 500 linhas onde possível).

## 19. Guia do usuário — passo a passo (UX final)

Esta seção descreve a experiência completa do usuário final, do zero ao primeiro comentário no telão. **Toda mensagem na UI deve refletir esses passos** (wizard, tooltips, mensagens de erro).

### Papéis envolvidos
- **Organizador** — cria o evento no Audience (pode ser remoto, em qualquer rede)
- **Operador do telão** — fica na máquina onde o H2R Graphics roda (no local do evento)
- **Audiência** — pessoas no evento que enviam comentários pelo celular

> Pode ser a mesma pessoa fazendo papéis diferentes em momentos diferentes.

### Setup completo (uma vez por evento, ~5 min)

#### Parte A — Organizador (no Audience web)
1. Acessa `audience.app/admin` → faz login com magic link (e-mail)
2. Clica **"+ Novo evento"**
3. Preenche:
   - Nome do evento (ex: "O Nascer de Uma Geração")
   - Slug da URL pública (ex: `nascer-2026` → vira `audience.app/e/nascer-2026`)
   - Tema visual (escolhe `geracao-2026` no dropdown ou cria um novo)
4. Clica **"Conectar ao H2R Graphics"**
5. Tela mostra:
   ```
   Código de pareamento: AUDIENCE-7K3M-Q9PX
   Expira em: 15:00
   ```
6. Compartilha esse código com o operador do telão (WhatsApp, e-mail, presencial)
7. Painel fica em estado **"Aguardando bridge..."**

#### Parte B — Operador do telão (na máquina do H2R)
1. Abre o **H2R Graphics** (já instalado)
2. Vai em `Data Sources` → `Add Source` → **"HTTP Listener"**
3. H2R cria o listener e mostra um source-id (ex: `UXKIOKQJAA`)
4. Em qualquer gráfico Social que quiser usar, configura aquele listener como fonte de dados
5. Abre um **terminal** na mesma máquina e roda:
   ```bash
   npx @ucob/h2r-bridge pair AUDIENCE-7K3M-Q9PX
   ```
6. CLI vai perguntar coisas no terminal:
   ```
   ? Source-id do HTTP Listener (encontra no H2R em Data Sources): UXKIOKQJAA
   ✓ Validando código de pareamento...
   ✓ Verificando H2R em http://localhost:4001...
   ✓ Baixando cloudflared (primeira vez apenas)...
   ✓ Iniciando tunnel...
   ✓ Tunnel ativo: https://abc-xyz.trycloudflare.com
   ✓ Conectado ao evento "O Nascer de Uma Geração"

   Pode minimizar este terminal — não feche enquanto o evento estiver no ar.
   Pressione Ctrl+C para encerrar.
   ```
7. Pronto. Deixa o terminal aberto durante todo o evento.

#### Parte C — Confirmação (no Audience web)
1. O painel do organizador atualiza automaticamente para **"✅ Conectado"**
2. Mostra a URL pública pra audiência: `audience.app/e/nascer-2026`
3. Pode imprimir QR code dessa URL pra exibir no telão / pôster

### Durante o evento

#### Audiência (celular)
1. Abre `audience.app/e/nascer-2026` (digitando ou escaneando QR)
2. Vê tela do evento com cores do tema
3. Preenche **Nome** + **Comentário**
4. Toca em **"Enviar"**
5. Vê confirmação: "Seu comentário foi enviado! Pode aparecer no telão se aprovado."

#### Operador (no painel `/admin/events/nascer-2026`)
1. Vê fila de pendentes em tempo real (sem refresh)
2. Cada card mostra: nome, comentário, hora, contagem de caracteres
3. Botões: **Aprovar** (verde) ou **Rejeitar** (cinza)
4. Ao clicar **Aprovar**:
   - Card muda pra "Enviando..."
   - Em ~1 segundo: "✅ No telão" (status `sent`)
   - Comentário aparece no telão via H2R Graphics imediatamente
5. Se algo der errado: card vira vermelho com mensagem (ex: "Bridge offline — verifique terminal do H2R")

### Encerramento
1. Operador: `Ctrl+C` no terminal do CLI → tunnel encerra
2. Organizador (opcional): no painel, clica "Encerrar evento" → URL pública para de aceitar submissões
3. Histórico de submissões fica salvo no Audience por 30 dias

### Solução de problemas comuns (deve aparecer em tooltips/help)

| Problema | Causa provável | Solução |
|---|---|---|
| Painel mostra "Bridge offline" | Terminal CLI fechado ou rede caiu na máquina H2R | Operador roda `npx @ucob/h2r-bridge resume` |
| Comentário aprovado mas status "failed" | H2R parou de rodar ou source-id mudou | Verificar H2R aberto + Data Source ainda existe |
| Pairing code expirou | Mais de 15 min entre gerar e usar | Organizador clica "Gerar novo código" |
| `cloudflared: command not found` | Primeira vez sem permissão de download | CLI instrui passos manuais ou pede permissão |
| Audiência diz "não consegue enviar" | RLS rejeitou ou rate limit acionou | Painel mostra contador de submissões/min — se > 100, talvez flood |

## 20. Workflow com Claude Superpowers (obrigatório por padrão de construção)

Toda fase usa skills do plugin `superpowers` (`obra/superpowers-marketplace`). Este projeto adota agents-first: nada de código antes de skill apropriada.

### Pré-implementação
- ✅ `superpowers:brainstorming` — usado para gerar este design (concluído)
- 🔜 `superpowers:writing-plans` — próximo passo: gera plano de implementação detalhado a partir desta spec

### Durante implementação
- `superpowers:executing-plans` — quando o plano é executado em sessão separada com checkpoints de review
- `superpowers:subagent-driven-development` — quando tarefas independentes do plano podem rodar em paralelo via subagents
- `superpowers:test-driven-development` — **obrigatório** para todo código com lógica (validators, payload builder H2R, parser cloudflared, RLS policies, server actions). Red → green → refactor.
- `superpowers:using-git-worktrees` — se a feature precisar isolamento (ex: mudança de schema grande durante outra implementação ativa)
- `superpowers:dispatching-parallel-agents` — quando 2+ tarefas independentes (ex: bridge CLI + página pública)

### Bug fixing
- `superpowers:systematic-debugging` — qualquer bug não resolvido em 15 min. Antes de propor fix.

### Pré-merge
- `superpowers:requesting-code-review` — em toda feature significativa
- `superpowers:verification-before-completion` — **obrigatório** antes de marcar qualquer PR pronta. Roda lint + typecheck + build + tests + manual smoke
- `superpowers:finishing-a-development-branch` — quando implementação completa, todos testes passando, decidir como integrar
- `superpowers:receiving-code-review` — ao receber feedback de review

### Skills auxiliares (não-superpowers, mas alinhadas ao padrão)
- `nextjs-developer`, `nextjs-server-client-components` — App Router
- `react-expert`, `composition-patterns` — componentes
- `typescript-pro` — tipos avançados
- `supabase-postgres-best-practices`, `postgres-pro`, `database-schema-design`
- `authentication-setup` — Supabase Auth + magic link
- `api-design` — contratos REST (`/api/pair/*`)
- `design-system`, `ui-component-patterns`, `responsive-design`, `visual-design-foundations`, `refactoring-ui` — design system + theming
- `frontend-design` — quando construir as páginas (form público + painel)
- `playwright-expert`, `webapp-testing` — E2E
- `security-best-practices`, `secure-code-guardian` — RLS, input sanitization, rate limit
- `monitoring-observability`, `core-web-vitals`, `performance` — Sentry + CWV
- `accessibility` — WCAG 2.1 AA em todos componentes UI

### Plugin install (uma vez, antes de começar)
```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```
Depois reiniciar Claude Code, validar com `/help`.

## 21. Como reverter (disaster recovery)

- Toda migration tem `up.sql` + `down.sql`
- Tabela `audit_log` (migration extra) registra approves/rejects pra forense
- Backup automático Supabase (free tier 7d)
- Rollback Vercel: 1 clique em UI
- Bridge CLI: versão fixa em `package.json`, rollback npm install antiga
- Runbook em `docs/runbooks/incidente-evento-ao-vivo.md` cobre: H2R offline mid-event, Vercel offline, banco lento, flood público

---

**Próximo passo:** após aprovação desta spec, invocar `superpowers:writing-plans` para gerar plano de implementação detalhado com checkpoints de review.
