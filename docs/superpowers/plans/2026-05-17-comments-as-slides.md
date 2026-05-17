# Comentários como Slide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar dois novos tipos de slide — `comments_feed` (cards um-por-um, mesmo comportamento do TelaoClient atual) e `comment_spotlight` (um comentário fixo, posicionável num grid 3×3) — pra que o operador organize tudo (nuvem, aberta, comentários) como slides sequenciáveis.

**Architecture:** Estende o enum `slide_type` no Postgres com os dois novos valores. `comments_feed` reaproveita o `TelaoClient` existente (ele já renderiza cards um-por-um — só passamos `config` vindo do slide em vez do `events.telao_config` global). `comment_spotlight` é um componente novo `SpotlightDisplay` que renderiza um único comentário num grid 3×3 (posição) × 3 (tamanho). Operador escolhe o comentário via picker na props panel OU clica "Mandar pro slide" na fila de moderação. Backwards-compat: `TelaoClient` continua sendo o fallback quando não há slide ativo.

**Tech Stack:** Next 16 App Router · Supabase Postgres · TypeScript · Tailwind v4 · Vitest · pnpm workspaces.

---

## File Structure

**New files:**
- `supabase/migrations/00420000_comments_slide_types.sql` — adiciona `comments_feed` e `comment_spotlight` ao enum `slide_type`
- `apps/web/components/telao/CommentSpotlightDisplay.tsx` — renderer do spotlight no telão
- `apps/web/components/telao/TelaoCommentsFeedSwitcher.tsx` — wrapper que ativa/desativa o TelaoClient via slide ativo
- `apps/web/components/audience/CommentsFeedPropsPanel.tsx` — props panel pro tipo `comments_feed`
- `apps/web/components/audience/CommentSpotlightPropsPanel.tsx` — props panel pro tipo `comment_spotlight`
- `apps/web/components/audience/SubmissionPicker.tsx` — modal que lista submissions aprovadas/enviadas pro spotlight
- `apps/web/components/telao/__tests__/CommentSpotlightDisplay.test.tsx` — testa positioning grid + size scaling

**Modified files:**
- `packages/shared-types/src/database.types.ts` — regenerado após migration
- `apps/web/lib/slides/types.ts` — adiciona `CommentsFeedConfig`, `CommentSpotlightConfig`, defaults, extende `SlideConfigByType`
- `apps/web/components/audience/SlideTypePicker.tsx` — marca os 2 novos tipos como `enabled: true`
- `apps/web/components/audience/SlidesTab.tsx` — defaults pros novos tipos no `createSlide`
- `apps/web/components/audience/SlideThumbnail.tsx` — thumbs visuais dos 2 novos tipos
- `apps/web/components/audience/SlidePropsPanel.tsx` — roteamento pros novos panels
- `apps/web/components/audience/SlideCanvas.tsx` — preview central dos 2 novos tipos
- `apps/web/components/audience/ModerationQueue.tsx` — botão "Mandar pro slide ativo" (aparece quando slide ativo é `comment_spotlight`)
- `apps/web/components/telao/ActiveSlideWatcher.tsx` — refresh ao trocar pros novos tipos
- `apps/web/app/telao/[slug]/page.tsx` — branch SSR pros 2 novos tipos
- `apps/web/server-actions/slides.ts` — (se necessário) action `setSpotlightSubmission(slideId, submissionId)`

---

## Phase 1 — Foundation (DB + types)

### Task 1: Estender enum `slide_type` no Postgres

**Files:**
- Create: `supabase/migrations/00420000_comments_slide_types.sql`

- [ ] **Step 1: Escrever migration**

```sql
-- 00420000_comments_slide_types.sql
-- Adiciona tipos de slide pra comentários:
--   comments_feed     → cards rotativos (mesmo comportamento do TelaoClient atual)
--   comment_spotlight → um comentário fixo, posicionável num grid 3×3
alter type public.slide_type add value if not exists 'comments_feed';
alter type public.slide_type add value if not exists 'comment_spotlight';
```

- [ ] **Step 2: Aplicar contra o Supabase hosted**

```bash
supabase db push
```

Expected: `Applying migration 00420000_comments_slide_types.sql... Done.`

- [ ] **Step 3: Regenerar tipos compartilhados**

```bash
pnpm --filter @audience/shared-types generate-types
```

Expected: `database.types.ts` atualizado com os 2 novos valores em `Enums.slide_type`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00420000_comments_slide_types.sql packages/shared-types/src/database.types.ts
git commit -m "feat(db): adiciona comments_feed + comment_spotlight ao slide_type"
```

---

### Task 2: Definir configs TS dos novos tipos

**Files:**
- Modify: `apps/web/lib/slides/types.ts`

- [ ] **Step 1: Adicionar tipos + defaults**

Editar `apps/web/lib/slides/types.ts` — depois do `DEFAULT_OPEN_ENDED_CONFIG`, antes do `SlideConfigByType`, adicionar:

```typescript
/**
 * Config do slide `comments_feed` (cards rotativos um-por-um).
 * Reaproveita o TelaoClient existente — esses campos são um subset do
 * TelaoConfig global, salvo no próprio slide pra independência.
 */
export type CommentsFeedConfig = {
  background?: WordcloudBackground;
  textColorOverride?: string;
  showAuthor?: boolean; // default true
  showQr?: boolean; // default true
  joinInfoType?: 'qr' | 'url' | 'code' | 'qr_and_url';
};

export const DEFAULT_COMMENTS_FEED_CONFIG: CommentsFeedConfig = {
  showAuthor: true,
  showQr: true,
  joinInfoType: 'qr_and_url',
};

/** Posições do grid 3×3 — primeira letra = vertical (t/m/b), segunda = horizontal (l/c/r). */
export type SpotlightPosition =
  | 'tl' | 'tc' | 'tr'
  | 'ml' | 'mc' | 'mr'
  | 'bl' | 'bc' | 'br';

export type SpotlightSize = 'sm' | 'md' | 'lg';

/**
 * Config do slide `comment_spotlight` — um comentário fixo, posicionável.
 * `submissionId` opcional: quando null, mostra placeholder "escolha um comentário".
 * `text`+`authorName` são snapshot — copiados quando operador escolhe,
 * sobrevivem mesmo se a submission original for deletada.
 */
export type CommentSpotlightConfig = {
  submissionId?: string | null;
  text?: string;
  authorName?: string | null;
  position: SpotlightPosition;
  size: SpotlightSize;
  background?: WordcloudBackground;
  textColorOverride?: string;
  showAuthor?: boolean; // default true
};

export const DEFAULT_COMMENT_SPOTLIGHT_CONFIG: CommentSpotlightConfig = {
  submissionId: null,
  position: 'mc',
  size: 'md',
  showAuthor: true,
};
```

- [ ] **Step 2: Estender `SlideConfigByType`**

No mesmo arquivo, atualizar:

```typescript
export type SlideConfigByType = {
  wordcloud: WordcloudConfig;
  poll: { question: string; options: string[]; allowMultiple: boolean };
  open_ended: OpenEndedConfig;
  rating: { question: string; scaleMin: number; scaleMax: number };
  qa: { question: string };
  comments_feed: CommentsFeedConfig;
  comment_spotlight: CommentSpotlightConfig;
};
```

- [ ] **Step 3: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS (zero errors).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/slides/types.ts
git commit -m "feat(slides): tipos CommentsFeedConfig e CommentSpotlightConfig"
```

---

### Task 3: Habilitar os tipos no SlideTypePicker

**Files:**
- Modify: `apps/web/components/audience/SlideTypePicker.tsx`

- [ ] **Step 1: Adicionar os 2 cards ao grupo principal**

Localizar o array `groups` (linha ~25). No primeiro grupo (logo após `open_ended`), adicionar dois itens com `enabled: true`. Importar um ícone novo de balão duplo (mantém SVG inline pra não criar dependência):

```tsx
// junto dos outros ícones SVG inline:
function CommentsFeedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5h12a2 2 0 012 2v6a2 2 0 01-2 2H9l-4 3v-3H4a2 2 0 01-2-2V7a2 2 0 012-2z"/>
      <path d="M8 19h12a2 2 0 002-2v-6" opacity=".5"/>
    </svg>
  );
}
function CommentSpotlightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <rect x="8" y="9" width="8" height="6" rx="1" fill="currentColor" opacity=".15"/>
      <path d="M8 9h8M8 12h6"/>
    </svg>
  );
}
```

Adicionar como primeiros itens do grupo "Popular" (acima de `wordcloud`):

```tsx
{ type: 'comments_feed',     label: 'Comentários (rotativo)', icon: <CommentsFeedIcon />,     enabled: true },
{ type: 'comment_spotlight', label: 'Destacar um comentário', icon: <CommentSpotlightIcon />, enabled: true },
```

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/audience/SlideTypePicker.tsx
git commit -m "feat(slides): card picker dos 2 novos tipos de comentário"
```

---

## Phase 2 — `comments_feed` (cards rotativos como slide)

### Task 4: Default config no SlidesTab.createSlide

**Files:**
- Modify: `apps/web/components/audience/SlidesTab.tsx`

- [ ] **Step 1: Localizar a função `createSlide`**

Procurar pelo handler que cria slide ao clicar no picker (geralmente chama `createSlideAction` do server-actions). Ele faz um `switch (type)` pra escolher o config inicial. Adicionar os 2 novos casos.

Trecho a localizar (varia por linha, mas a estrutura é `switch(type) { case 'wordcloud': ... case 'open_ended': ... }`):

```tsx
let config: SlideConfigByType[SlideType];
switch (type) {
  case 'wordcloud':
    config = { /* DEFAULT_WORDCLOUD_CONFIG existente */ } as WordcloudConfig;
    break;
  case 'open_ended':
    config = DEFAULT_OPEN_ENDED_CONFIG;
    break;
  // ADICIONAR:
  case 'comments_feed':
    config = DEFAULT_COMMENTS_FEED_CONFIG;
    break;
  case 'comment_spotlight':
    config = DEFAULT_COMMENT_SPOTLIGHT_CONFIG;
    break;
  default:
    config = {} as SlideConfigByType[SlideType];
}
```

Garantir que os imports estão presentes:

```tsx
import {
  DEFAULT_OPEN_ENDED_CONFIG,
  DEFAULT_COMMENTS_FEED_CONFIG,
  DEFAULT_COMMENT_SPOTLIGHT_CONFIG,
} from '@/lib/slides/types';
```

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Smoke test manual**

```bash
pnpm --filter @audience/web dev
```

Abrir evento → aba Slides → clicar "+ Adicionar slide" → escolher "Comentários (rotativo)". Slide novo aparece na lista com tipo `comments_feed`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/audience/SlidesTab.tsx
git commit -m "feat(slides): defaults para comments_feed e comment_spotlight"
```

---

### Task 5: Props panel do comments_feed

**Files:**
- Create: `apps/web/components/audience/CommentsFeedPropsPanel.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client';

import { useCallback } from 'react';

import { BackgroundGrid } from '@/components/audience/BackgroundGrid';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import type { CommentsFeedConfig } from '@/lib/slides/types';

type Props = {
  config: CommentsFeedConfig;
  onChange: (next: CommentsFeedConfig) => void;
};

/**
 * Props panel pro slide `comments_feed`. Mesma estrutura visual da
 * WordCloudSlideEditor / OpenEndedPropsPanel (Conteúdo · Design).
 * Apenas 2 toggles + grid de fundos — o conteúdo vem da fila de moderação.
 */
export function CommentsFeedPropsPanel({ config, onChange }: Props) {
  const patch = useCallback(
    (p: Partial<CommentsFeedConfig>) => onChange({ ...config, ...p }),
    [config, onChange],
  );
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display text-sm uppercase tracking-wide text-ink/60 mb-3">Conteúdo</h3>
        <Toggle
          label="Mostrar nome do autor"
          checked={config.showAuthor !== false}
          onChange={(v) => patch({ showAuthor: v })}
        />
        <Toggle
          label="Mostrar QR code"
          checked={config.showQr !== false}
          onChange={(v) => patch({ showQr: v })}
        />
      </Card>
      <Card>
        <h3 className="font-display text-sm uppercase tracking-wide text-ink/60 mb-3">Design</h3>
        <BackgroundGrid
          value={config.background}
          onChange={(bg) => patch({ background: bg })}
        />
      </Card>
    </div>
  );
}
```

> **Nota:** se `BackgroundGrid` ou `Toggle` não existirem com esse nome exato, conferir como WordcloudSlideEditor / OpenEndedPropsPanel renderizam essas UIs e seguir o padrão. O componente deve seguir o mesmo visual.

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Roteamento no SlidePropsPanel**

Editar `apps/web/components/audience/SlidePropsPanel.tsx` — adicionar caso `comments_feed` no switch que escolhe qual panel mostrar:

```tsx
if (slide.type === 'comments_feed') {
  return (
    <CommentsFeedPropsPanel
      config={slide.config as CommentsFeedConfig}
      onChange={(c) => onConfigChange(c)}
    />
  );
}
```

Adicionar import:

```tsx
import { CommentsFeedPropsPanel } from './CommentsFeedPropsPanel';
import type { CommentsFeedConfig } from '@/lib/slides/types';
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/audience/CommentsFeedPropsPanel.tsx apps/web/components/audience/SlidePropsPanel.tsx
git commit -m "feat(slides): props panel do comments_feed"
```

---

### Task 6: Renderer no telão — TelaoCommentsFeedSwitcher

**Files:**
- Create: `apps/web/components/telao/TelaoCommentsFeedSwitcher.tsx`
- Modify: `apps/web/app/telao/[slug]/page.tsx`

- [ ] **Step 1: Criar o switcher**

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import type { CommentsFeedConfig } from '@/lib/slides/types';

type ChannelLike = NonNullable<Parameters<typeof useActiveSlideConfig>[1]['channel']>;

type Props = {
  eventId: string;
  initialActiveSlideId: string | null;
  initialConfig: CommentsFeedConfig;
  /** TelaoClient já configurado com config base; aqui só passa pra ele. */
  children: (config: CommentsFeedConfig) => ReactNode;
};

/**
 * Hook + provider: quando o slide ativo é `comments_feed`, expõe sua config
 * pra que o caller (page.tsx) renderize o TelaoClient com ela. Reage em
 * tempo real a mudanças no slide via Realtime.
 */
export function TelaoCommentsFeedSwitcher({
  eventId,
  initialActiveSlideId,
  initialConfig,
  children,
}: Props) {
  const [channel, setChannel] = useState<ChannelLike | undefined>(undefined);

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ch = rt.channel(`telao:${eventId}:cfeed:${Date.now()}`) as unknown as ChannelLike;
    setChannel(ch);
    return () => {
      ch?.unsubscribe();
    };
  }, [eventId]);

  const slide = useActiveSlideConfig(eventId, {
    initialActiveSlideId,
    initialActiveConfig: initialConfig,
    channel,
  });

  const config: CommentsFeedConfig =
    slide.activeType === 'comments_feed' && slide.config
      ? (slide.config as CommentsFeedConfig)
      : initialConfig;

  return <>{children(config)}</>;
}
```

- [ ] **Step 2: Branch no SSR de `/telao/[slug]/page.tsx`**

Localizar a seção que detecta `activeSlideType` (~linha 100). Adicionar branch pra `comments_feed`:

```tsx
let activeCommentsFeedConfig: CommentsFeedConfig | null = null;
// ... dentro do if (activeSlideId)
if (slideRow?.type === 'comments_feed') {
  activeCommentsFeedConfig = { ...DEFAULT_COMMENTS_FEED_CONFIG, ...((slideRow.config as Partial<CommentsFeedConfig>) ?? {}) };
  activeSlideType = 'comments_feed';
}
```

Adicionar import:

```tsx
import { DEFAULT_COMMENTS_FEED_CONFIG, type CommentsFeedConfig } from '@/lib/slides/types';
import { TelaoCommentsFeedSwitcher } from '@/components/telao/TelaoCommentsFeedSwitcher';
```

No `if/else` que decide qual renderer entregar (após `open_ended`), adicionar branch:

```tsx
} else if (activeSlideType === 'comments_feed' && activeCommentsFeedConfig && activeSlideId) {
  telao = (
    <TelaoCommentsFeedSwitcher
      eventId={event.event_id}
      initialActiveSlideId={activeSlideId}
      initialConfig={activeCommentsFeedConfig}
    >
      {(cfg) => (
        <TelaoClient
          slug={slug}
          eventId={event.event_id}
          eventName={event.event_name}
          config={{
            ...config,
            background: cfg.background ?? config.background,
            showAuthor: cfg.showAuthor,
            showQr: cfg.showQr,
            joinInfoType: cfg.joinInfoType ?? config.joinInfoType,
            textColorOverride: cfg.textColorOverride ?? config.textColorOverride,
          }}
          intervalSeconds={ev?.dispatch_interval_seconds ?? 3}
          preview={isPreview}
        />
      )}
    </TelaoCommentsFeedSwitcher>
  );
}
```

> **Importante:** o spread acima depende dos campos que `TelaoClient` aceita. Se `TelaoClient.config` não tiver `showAuthor` etc., adicionar esses campos ao tipo `TelaoConfig` em `apps/web/lib/telao/config.ts` (manter opcional pra não quebrar mode existente).

- [ ] **Step 3: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Smoke test manual**

```bash
pnpm --filter @audience/web dev
```

1. Criar slide tipo "Comentários (rotativo)"
2. Ativar slide
3. Abrir `/telao/<slug>` em outra aba
4. Aprovar um comentário na aba Comentários → Moderação
5. Verificar que ele aparece como card no telão
6. Mudar background na props panel → telão atualiza em tempo real

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/telao/TelaoCommentsFeedSwitcher.tsx apps/web/app/telao/[slug]/page.tsx apps/web/lib/telao/config.ts
git commit -m "feat(telao): renderiza comments_feed como slide com config própria"
```

---

### Task 7: ActiveSlideWatcher reconhece comments_feed

**Files:**
- Modify: `apps/web/components/telao/ActiveSlideWatcher.tsx`

- [ ] **Step 1: Inspecionar o watcher**

Abrir `ActiveSlideWatcher.tsx`. Ele força refresh quando o tipo do slide ativo muda (commit `fac4123 fix(slides): troca de tipo do slide propaga pra telão`). A lógica é `if (activeType !== initialActiveType) router.refresh()`. Conferir que `'comments_feed' | 'comment_spotlight'` estão no tipo `activeType` aceito (provavelmente é só `SlideType | null`, então já passa).

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS sem mudanças OU ajustar tipo se restrito a `'wordcloud' | 'open_ended'`.

- [ ] **Step 3: Commit (se houve mudança)**

```bash
git add apps/web/components/telao/ActiveSlideWatcher.tsx
git commit -m "fix(telao): ActiveSlideWatcher aceita comments_feed/spotlight"
```

---

### Task 8: SlideThumbnail + SlideCanvas — preview do comments_feed

**Files:**
- Modify: `apps/web/components/audience/SlideThumbnail.tsx`
- Modify: `apps/web/components/audience/SlideCanvas.tsx`

- [ ] **Step 1: Thumbnail mostra mini-card**

Em `SlideThumbnail.tsx`, localizar o switch que renderiza miniatura por tipo. Adicionar caso `comments_feed`:

```tsx
if (slide.type === 'comments_feed') {
  const cfg = slide.config as CommentsFeedConfig;
  return (
    <div className="relative w-full h-full overflow-hidden rounded-md bg-bg-2" style={bgStyle(cfg.background)}>
      <div className="absolute inset-2 flex items-center justify-center">
        <div className="w-3/4 rounded-md bg-white/90 px-2 py-1.5 shadow-sm">
          <div className="h-1.5 w-3/4 rounded bg-ink/30 mb-1" />
          <div className="h-1.5 w-1/2 rounded bg-ink/20" />
        </div>
      </div>
    </div>
  );
}
```

> Usar o helper existente `bgStyle(bg)` que já é usado pelos outros thumbnails. Se não existir, copiar a lógica de aplicar `background` do WordcloudSlideEditor.

- [ ] **Step 2: SlideCanvas mostra preview real**

Em `SlideCanvas.tsx`, no switch de tipos, adicionar:

```tsx
if (slide.type === 'comments_feed') {
  const cfg = slide.config as CommentsFeedConfig;
  return (
    <div className="w-full h-full grid place-items-center" style={bgStyle(cfg.background)}>
      <div className="max-w-2xl w-full bg-white/95 rounded-2xl p-8 shadow-lg">
        <p className="text-2xl text-ink mb-3">"Exemplo de comentário da audiência aparecerá aqui."</p>
        {cfg.showAuthor !== false ? <p className="text-sm text-ink/60">— Convidado</p> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/audience/SlideThumbnail.tsx apps/web/components/audience/SlideCanvas.tsx
git commit -m "feat(slides): thumb + canvas preview pro comments_feed"
```

---

## Phase 3 — `comment_spotlight` (1 comentário fixo, posicionável)

### Task 9: SpotlightDisplay (renderer no telão)

**Files:**
- Create: `apps/web/components/telao/CommentSpotlightDisplay.tsx`

- [ ] **Step 1: Escrever teste de positioning**

Create `apps/web/components/telao/__tests__/CommentSpotlightDisplay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CommentSpotlightDisplay } from '../CommentSpotlightDisplay';
import { DEFAULT_COMMENT_SPOTLIGHT_CONFIG } from '@/lib/slides/types';

describe('CommentSpotlightDisplay', () => {
  it('renderiza texto e autor', () => {
    render(
      <CommentSpotlightDisplay
        config={{ ...DEFAULT_COMMENT_SPOTLIGHT_CONFIG, text: 'Hello world', authorName: 'Davi' }}
      />,
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText(/Davi/)).toBeInTheDocument();
  });

  it('aplica classes de posição para tl (top-left)', () => {
    const { container } = render(
      <CommentSpotlightDisplay
        config={{ ...DEFAULT_COMMENT_SPOTLIGHT_CONFIG, text: 'x', position: 'tl' }}
      />,
    );
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toMatch(/items-start/);
    expect(wrap.className).toMatch(/justify-start/);
  });

  it('aplica classes de posição para br (bottom-right)', () => {
    const { container } = render(
      <CommentSpotlightDisplay
        config={{ ...DEFAULT_COMMENT_SPOTLIGHT_CONFIG, text: 'x', position: 'br' }}
      />,
    );
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toMatch(/items-end/);
    expect(wrap.className).toMatch(/justify-end/);
  });

  it('placeholder quando submissionId é null e text vazio', () => {
    render(
      <CommentSpotlightDisplay
        config={{ ...DEFAULT_COMMENT_SPOTLIGHT_CONFIG, submissionId: null, text: undefined }}
      />,
    );
    expect(screen.getByText(/escolha um comentário/i)).toBeInTheDocument();
  });

  it('oculta autor quando showAuthor=false', () => {
    render(
      <CommentSpotlightDisplay
        config={{
          ...DEFAULT_COMMENT_SPOTLIGHT_CONFIG,
          text: 'x',
          authorName: 'Davi',
          showAuthor: false,
        }}
      />,
    );
    expect(screen.queryByText(/Davi/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter @audience/web vitest run components/telao/__tests__/CommentSpotlightDisplay.test.tsx
```

Expected: FAIL — "Cannot find module '../CommentSpotlightDisplay'".

- [ ] **Step 3: Implementar o componente**

```tsx
'use client';

import type { CommentSpotlightConfig, SpotlightPosition, SpotlightSize } from '@/lib/slides/types';

const VERT: Record<SpotlightPosition[0] & string, string> = {
  t: 'items-start',
  m: 'items-center',
  b: 'items-end',
};
const HORZ: Record<SpotlightPosition[1] & string, string> = {
  l: 'justify-start',
  c: 'justify-center',
  r: 'justify-end',
};

const SIZE_TEXT: Record<SpotlightSize, string> = {
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-7xl',
};
const SIZE_PAD: Record<SpotlightSize, string> = {
  sm: 'p-6 max-w-xl',
  md: 'p-10 max-w-3xl',
  lg: 'p-14 max-w-5xl',
};

type Props = { config: CommentSpotlightConfig };

/**
 * Renderiza um único comentário num grid 3×3. Position é `<v><h>` onde
 * v∈{t,m,b} e h∈{l,c,r}. Size ∈ {sm,md,lg} escala texto + padding + max-width.
 * Quando `text` está vazio mostra um placeholder neutral.
 */
export function CommentSpotlightDisplay({ config }: Props) {
  const v = (config.position?.[0] ?? 'm') as keyof typeof VERT;
  const h = (config.position?.[1] ?? 'c') as keyof typeof HORZ;
  const size = config.size ?? 'md';
  const hasContent = Boolean(config.text);

  return (
    <div className={`w-full h-full flex ${VERT[v]} ${HORZ[h]} p-12`}>
      <div
        className={`rounded-2xl bg-white/95 shadow-xl ${SIZE_PAD[size]}`}
        style={config.textColorOverride ? { color: config.textColorOverride } : undefined}
      >
        {hasContent ? (
          <>
            <p className={`font-display leading-tight ${SIZE_TEXT[size]}`}>"{config.text}"</p>
            {config.showAuthor !== false && config.authorName ? (
              <p className="mt-4 text-xl opacity-60">— {config.authorName}</p>
            ) : null}
          </>
        ) : (
          <p className="text-xl text-ink/40">Escolha um comentário pra exibir aqui</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar — deve passar**

```bash
pnpm --filter @audience/web vitest run components/telao/__tests__/CommentSpotlightDisplay.test.tsx
```

Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/telao/CommentSpotlightDisplay.tsx apps/web/components/telao/__tests__/CommentSpotlightDisplay.test.tsx
git commit -m "feat(spotlight): CommentSpotlightDisplay com grid 3x3 e 3 tamanhos"
```

---

### Task 10: RPC `list_event_submissions_for_spotlight`

> Necessária pra o picker dentro da props panel listar comentários aprovados/enviados (sem expor dados além do que o operador já vê em Moderação).

**Files:**
- Modify: `supabase/migrations/00420000_comments_slide_types.sql` (ou nova migration `00430000_spotlight_picker_rpc.sql` se 00420000 já aplicada)

- [ ] **Step 1: Decidir se cria nova migration**

```bash
ls -la supabase/migrations/00420000_comments_slide_types.sql
```

Se a migration já foi aplicada (Task 1 step 2), criar **nova** migration `00430000_spotlight_picker_rpc.sql`. Senão, anexar ao 00420000.

- [ ] **Step 2: Escrever a RPC**

```sql
-- 00430000_spotlight_picker_rpc.sql
-- RPC pro spotlight picker: lista submissions do evento (aprovadas/enviadas)
-- pra operador escolher qual destacar. Segurança via has_event_access.

create or replace function public.list_event_submissions_for_spotlight(
  p_event_id uuid
) returns table (
  id uuid,
  name text,
  comment text,
  status public.submission_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_event_access(p_event_id) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query
    select s.id, s.name, s.comment, s.status, s.created_at
      from public.submissions s
     where s.event_id = p_event_id
       and s.status in ('approved', 'sent')
     order by s.created_at desc
     limit 200;
end;
$$;

grant execute on function public.list_event_submissions_for_spotlight(uuid) to authenticated;
```

> **Conferir** que `has_event_access(uuid)` existe (foi criada em migrations anteriores). Se não, replicar a verificação manual: `exists (... events where id=p_event_id and owner_id=auth.uid()) or exists (... event_members where ...)`.

- [ ] **Step 3: Aplicar**

```bash
supabase db push
```

Expected: `Done.`

- [ ] **Step 4: Regenerar tipos**

```bash
pnpm --filter @audience/shared-types generate-types
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00430000_spotlight_picker_rpc.sql packages/shared-types/src/database.types.ts
git commit -m "feat(db): RPC list_event_submissions_for_spotlight"
```

---

### Task 11: SubmissionPicker (modal)

**Files:**
- Create: `apps/web/components/audience/SubmissionPicker.tsx`

- [ ] **Step 1: Criar componente**

```tsx
'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Submission = {
  id: string;
  name: string;
  comment: string;
  status: 'approved' | 'sent';
  created_at: string;
};

type Props = {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onPick: (s: { id: string; comment: string; name: string }) => void;
};

/**
 * Modal que lista comentários aprovados/enviados do evento.
 * Operador clica num pra selecionar; texto+autor são copiados pro slide
 * (snapshot, não FK live — sobrevive a deletes).
 */
export function SubmissionPicker({ eventId, open, onClose, onPick }: Props) {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const sb = getSupabaseBrowserClient();
    void sb
      .rpc('list_event_submissions_for_spotlight', { p_event_id: eventId })
      .then(({ data }) => {
        setItems((data ?? []) as Submission[]);
        setLoading(false);
      });
  }, [eventId, open]);

  if (!open) return null;

  return (
    <Modal onClose={onClose} title="Escolher comentário">
      {loading ? (
        <p className="text-sm text-ink/60">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/60">
          Nenhum comentário aprovado ainda. Aprove comentários na aba Moderação primeiro.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: s.id, comment: s.comment, name: s.name });
                  onClose();
                }}
                className="w-full text-left p-3 rounded-md border border-ink/10 hover:bg-bg-2 transition"
              >
                <p className="text-sm text-ink">"{s.comment}"</p>
                <p className="text-xs text-ink/50 mt-1">
                  — {s.name} · {new Date(s.created_at).toLocaleString('pt-BR')}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose} variant="ghost">Cancelar</Button>
      </div>
    </Modal>
  );
}
```

> Se `Modal` e `Button` não existirem, conferir o padrão UI nos outros panels e reusar/criar minimal stubs.

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/audience/SubmissionPicker.tsx
git commit -m "feat(spotlight): SubmissionPicker modal"
```

---

### Task 12: Props panel do comment_spotlight

**Files:**
- Create: `apps/web/components/audience/CommentSpotlightPropsPanel.tsx`
- Modify: `apps/web/components/audience/SlidePropsPanel.tsx`

- [ ] **Step 1: Criar o panel**

```tsx
'use client';

import { useCallback, useState } from 'react';

import { BackgroundGrid } from '@/components/audience/BackgroundGrid';
import { SubmissionPicker } from '@/components/audience/SubmissionPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import type {
  CommentSpotlightConfig,
  SpotlightPosition,
  SpotlightSize,
} from '@/lib/slides/types';

const POSITIONS: SpotlightPosition[] = [
  'tl', 'tc', 'tr',
  'ml', 'mc', 'mr',
  'bl', 'bc', 'br',
];
const SIZES: SpotlightSize[] = ['sm', 'md', 'lg'];

type Props = {
  eventId: string;
  config: CommentSpotlightConfig;
  onChange: (next: CommentSpotlightConfig) => void;
};

export function CommentSpotlightPropsPanel({ eventId, config, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const patch = useCallback(
    (p: Partial<CommentSpotlightConfig>) => onChange({ ...config, ...p }),
    [config, onChange],
  );
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display text-sm uppercase tracking-wide text-ink/60 mb-3">Conteúdo</h3>
        <div className="space-y-2">
          <label className="block text-xs text-ink/60">Comentário</label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-ink/10 p-2 text-sm"
            value={config.text ?? ''}
            placeholder="Digite ou escolha um comentário…"
            onChange={(e) => patch({ text: e.target.value })}
          />
          <label className="block text-xs text-ink/60 mt-2">Autor</label>
          <input
            className="w-full rounded-md border border-ink/10 p-2 text-sm"
            value={config.authorName ?? ''}
            placeholder="Ex: João da Silva"
            onChange={(e) => patch({ authorName: e.target.value })}
          />
          <Button variant="ghost" onClick={() => setPickerOpen(true)} className="mt-2">
            📋 Escolher da fila de moderação
          </Button>
        </div>
        <Toggle
          label="Mostrar nome do autor"
          checked={config.showAuthor !== false}
          onChange={(v) => patch({ showAuthor: v })}
        />
      </Card>

      <Card>
        <h3 className="font-display text-sm uppercase tracking-wide text-ink/60 mb-3">Posição</h3>
        <div className="grid grid-cols-3 gap-2 max-w-[180px]">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => patch({ position: p })}
              aria-label={`Posição ${p}`}
              className={`aspect-square rounded-md border-2 ${
                config.position === p
                  ? 'border-primary bg-primary/10'
                  : 'border-ink/10 hover:border-ink/30'
              }`}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-sm uppercase tracking-wide text-ink/60 mb-3">Tamanho</h3>
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patch({ size: s })}
              className={`flex-1 py-2 rounded-md border-2 text-sm uppercase ${
                config.size === s
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-ink/10 text-ink/60 hover:border-ink/30'
              }`}
            >
              {s === 'sm' ? 'Pequeno' : s === 'md' ? 'Médio' : 'Grande'}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-sm uppercase tracking-wide text-ink/60 mb-3">Design</h3>
        <BackgroundGrid value={config.background} onChange={(bg) => patch({ background: bg })} />
      </Card>

      <SubmissionPicker
        eventId={eventId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={({ id, comment, name }) =>
          patch({ submissionId: id, text: comment, authorName: name })
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Roteamento em SlidePropsPanel**

```tsx
if (slide.type === 'comment_spotlight') {
  return (
    <CommentSpotlightPropsPanel
      eventId={eventId}
      config={slide.config as CommentSpotlightConfig}
      onChange={(c) => onConfigChange(c)}
    />
  );
}
```

Adicionar imports. Garantir que `SlidePropsPanel` recebe `eventId` como prop (provavelmente já recebe — conferir).

- [ ] **Step 3: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/audience/CommentSpotlightPropsPanel.tsx apps/web/components/audience/SlidePropsPanel.tsx
git commit -m "feat(spotlight): props panel com picker + grid 3x3 + tamanhos"
```

---

### Task 13: Wiring SSR no /telao/[slug]/page.tsx

**Files:**
- Modify: `apps/web/app/telao/[slug]/page.tsx`

- [ ] **Step 1: Branch pra `comment_spotlight`**

Junto dos outros branches no SSR (após `comments_feed`), adicionar:

```tsx
let activeSpotlightConfig: CommentSpotlightConfig | null = null;
// ... dentro do if (activeSlideId)
if (slideRow?.type === 'comment_spotlight') {
  activeSpotlightConfig = {
    ...DEFAULT_COMMENT_SPOTLIGHT_CONFIG,
    ...((slideRow.config as Partial<CommentSpotlightConfig>) ?? {}),
  };
  activeSlideType = 'comment_spotlight';
}
```

E no switch que decide o renderer:

```tsx
} else if (activeSlideType === 'comment_spotlight' && activeSpotlightConfig && activeSlideId) {
  telao = (
    <TelaoStage>
      <div className="w-full h-full" style={bgStyle(activeSpotlightConfig.background)}>
        <CommentSpotlightDisplay config={activeSpotlightConfig} />
      </div>
    </TelaoStage>
  );
}
```

> **Sobre realtime:** o spotlight precisa reagir a mudanças do `slides.config` (operador troca posição). Usar um wrapper client similar ao `TelaoCommentsFeedSwitcher`, mas pra simplicidade pode reaproveitar `useActiveSlideConfig` direto dentro de um novo componente client `TelaoSpotlightSwitcher` — segue o mesmo padrão do feed.

Criar `apps/web/components/telao/TelaoSpotlightSwitcher.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

import { CommentSpotlightDisplay } from '@/components/telao/CommentSpotlightDisplay';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import type { CommentSpotlightConfig } from '@/lib/slides/types';

type ChannelLike = NonNullable<Parameters<typeof useActiveSlideConfig>[1]['channel']>;

type Props = {
  eventId: string;
  initialActiveSlideId: string;
  initialConfig: CommentSpotlightConfig;
};

export function TelaoSpotlightSwitcher({ eventId, initialActiveSlideId, initialConfig }: Props) {
  const [channel, setChannel] = useState<ChannelLike | undefined>(undefined);
  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ch = rt.channel(`telao:${eventId}:spotlight:${Date.now()}`) as unknown as ChannelLike;
    setChannel(ch);
    return () => { ch?.unsubscribe(); };
  }, [eventId]);

  const slide = useActiveSlideConfig(eventId, {
    initialActiveSlideId,
    initialActiveConfig: initialConfig,
    channel,
  });

  const config: CommentSpotlightConfig =
    slide.activeType === 'comment_spotlight' && slide.config
      ? (slide.config as CommentSpotlightConfig)
      : initialConfig;

  return <CommentSpotlightDisplay config={config} />;
}
```

E no page.tsx usar `<TelaoSpotlightSwitcher>` em vez do `<CommentSpotlightDisplay>` direto.

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Smoke test manual**

```bash
pnpm --filter @audience/web dev
```

1. Criar slide "Destacar um comentário"
2. Na props panel, escolher um comentário aprovado
3. Mudar posição pra `bl` (canto inferior esquerdo)
4. Ativar slide
5. Abrir `/telao/<slug>` → comentário aparece no canto inferior esquerdo
6. Trocar tamanho pra `lg` → texto fica maior em tempo real

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/telao/[slug]/page.tsx apps/web/components/telao/TelaoSpotlightSwitcher.tsx
git commit -m "feat(telao): SSR + switcher do comment_spotlight"
```

---

### Task 14: Thumbnail + Canvas preview do spotlight

**Files:**
- Modify: `apps/web/components/audience/SlideThumbnail.tsx`
- Modify: `apps/web/components/audience/SlideCanvas.tsx`

- [ ] **Step 1: Thumbnail**

Adicionar caso `comment_spotlight` no SlideThumbnail. Posicionar mini-quadrado segundo o `position` config:

```tsx
if (slide.type === 'comment_spotlight') {
  const cfg = slide.config as CommentSpotlightConfig;
  const v = (cfg.position?.[0] ?? 'm') as 't' | 'm' | 'b';
  const h = (cfg.position?.[1] ?? 'c') as 'l' | 'c' | 'r';
  const align = {
    t: 'items-start', m: 'items-center', b: 'items-end',
  }[v];
  const justify = {
    l: 'justify-start', c: 'justify-center', r: 'justify-end',
  }[h];
  return (
    <div className={`relative w-full h-full p-1.5 flex ${align} ${justify} rounded-md bg-bg-2`} style={bgStyle(cfg.background)}>
      <div className="rounded bg-white/90 px-1.5 py-1 shadow-sm">
        <div className="h-1 w-8 rounded bg-ink/30 mb-0.5" />
        <div className="h-1 w-5 rounded bg-ink/20" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SlideCanvas preview real**

```tsx
if (slide.type === 'comment_spotlight') {
  const cfg = slide.config as CommentSpotlightConfig;
  return (
    <div className="w-full h-full" style={bgStyle(cfg.background)}>
      <CommentSpotlightDisplay config={cfg} />
    </div>
  );
}
```

Importar `CommentSpotlightDisplay`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/audience/SlideThumbnail.tsx apps/web/components/audience/SlideCanvas.tsx
git commit -m "feat(spotlight): thumb + canvas preview seguindo position"
```

---

### Task 15: "Mandar pro slide ativo" na fila de moderação

**Files:**
- Modify: `apps/web/components/audience/ModerationQueue.tsx`
- Modify: `apps/web/server-actions/slides.ts`

> **Bonus UX:** quando o slide ativo é `comment_spotlight`, aparece botão "📌 Spotlight" em cada submission aprovada. Click → atualiza `slide.config.submissionId/text/authorName`.

- [ ] **Step 1: Server action**

Adicionar em `apps/web/server-actions/slides.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function setSpotlightSubmission(args: {
  slideId: string;
  submissionId: string;
  text: string;
  authorName: string;
}) {
  const supabase = await getSupabaseServerClient();
  const { data: slide, error: readErr } = await supabase
    .from('slides')
    .select('id, type, config, event_id')
    .eq('id', args.slideId)
    .single();
  if (readErr || !slide || slide.type !== 'comment_spotlight') {
    return { ok: false as const, error: 'slide_inválido' };
  }
  const nextConfig = {
    ...((slide.config as Record<string, unknown>) ?? {}),
    submissionId: args.submissionId,
    text: args.text,
    authorName: args.authorName,
  };
  const { error } = await supabase
    .from('slides')
    .update({ config: nextConfig })
    .eq('id', args.slideId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/admin/events/[slug]`, 'page');
  return { ok: true as const };
}
```

- [ ] **Step 2: Botão na fila**

Em `ModerationQueue.tsx`, receber prop `activeSpotlightSlideId: string | null` (vinda do `page.tsx` que já busca `activeSlideId`). Em cada item com status `approved | sent`, mostrar:

```tsx
{activeSpotlightSlideId ? (
  <button
    type="button"
    onClick={() =>
      void setSpotlightSubmission({
        slideId: activeSpotlightSlideId,
        submissionId: sub.id,
        text: sub.comment,
        authorName: sub.name,
      })
    }
    className="text-xs text-primary hover:underline"
    title="Destacar este comentário no slide ativo"
  >
    📌 Spotlight
  </button>
) : null}
```

> No `page.tsx`, calcular `activeSpotlightSlideId`:
>
> ```tsx
> const activeSlideRow = activeSlideId
>   ? slides.find((s) => s.id === activeSlideId)
>   : null;
> const activeSpotlightSlideId =
>   activeSlideRow?.type === 'comment_spotlight' ? activeSlideRow.id : null;
> ```
>
> Passar como prop pra `<ModerationQueue activeSpotlightSlideId={…} />`.

- [ ] **Step 3: Smoke test manual**

1. Criar slide `comment_spotlight`, ativar
2. Ir na aba Comentários → Moderação
3. Aprovar um comentário
4. Clicar 📌 Spotlight ao lado dele
5. Telão atualiza pra mostrar esse comentário

- [ ] **Step 4: Commit**

```bash
git add apps/web/server-actions/slides.ts apps/web/components/audience/ModerationQueue.tsx apps/web/app/admin/events/[slug]/page.tsx
git commit -m "feat(spotlight): botão Spotlight na fila de moderação"
```

---

## Phase 4 — Polish e edge cases

### Task 16: Atualizar legenda da aba "Comentários" → "Telão" pra refletir slides

**Files:**
- Modify: `apps/web/components/audience/CommentsTab.tsx` (e/ou page.tsx)

> **Contexto:** A sub-tab "Telão" dentro de "Comentários" hoje mostra o preview do TelaoClient. Quando há slide ativo do tipo comments_*, ela deveria refletir isso ou indicar "preview agora vive em Slides". Decidir UX:
> - **Opção A (mínima):** Adicionar banner no topo da sub-tab Telão: "💡 Se há um slide ativo, o telão mostra ele. Pra editar o card de comentário em si, vá pra aba Slides."
> - **Opção B:** Esconder a sub-tab Telão quando há slide do tipo comments_* ativo.

- [ ] **Step 1: Adotar Opção A (menor risco)**

Em `CommentsTab.tsx`, adicionar banner condicional. Receber nova prop `hasActiveCommentsSlide: boolean`:

```tsx
<div hidden={tab !== 'telao'}>
  {hasActiveCommentsSlide ? (
    <div className="mb-3 rounded-md bg-accent/10 border border-accent/20 p-3 text-sm text-ink/80">
      💡 Há um slide de comentários ativo. O telão mostra ele em vez do card padrão.
      Edite o slide na aba <strong>Slides</strong>.
    </div>
  ) : null}
  {telao}
</div>
```

Em `page.tsx`, calcular e passar:

```tsx
const activeSlideRow = activeSlideId ? slides.find((s) => s.id === activeSlideId) : null;
const hasActiveCommentsSlide =
  activeSlideRow?.type === 'comments_feed' || activeSlideRow?.type === 'comment_spotlight';
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/audience/CommentsTab.tsx apps/web/app/admin/events/[slug]/page.tsx
git commit -m "feat(admin): banner indicando slide de comentário ativo"
```

---

### Task 17: Regression test — TelaoClient continua fallback sem slide ativo

**Files:**
- Create: `apps/web/components/telao/__tests__/TelaoCommentsFeedSwitcher.test.tsx`

- [ ] **Step 1: Escrever teste**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TelaoCommentsFeedSwitcher } from '../TelaoCommentsFeedSwitcher';
import { DEFAULT_COMMENTS_FEED_CONFIG } from '@/lib/slides/types';

describe('TelaoCommentsFeedSwitcher', () => {
  it('renderiza children com config inicial quando sem slide', () => {
    render(
      <TelaoCommentsFeedSwitcher
        eventId="e1"
        initialActiveSlideId={null}
        initialConfig={DEFAULT_COMMENTS_FEED_CONFIG}
      >
        {(cfg) => <div data-testid="child">{cfg.showAuthor ? 'autor' : 'sem-autor'}</div>}
      </TelaoCommentsFeedSwitcher>,
    );
    expect(screen.getByTestId('child').textContent).toBe('autor');
  });
});
```

- [ ] **Step 2: Rodar**

```bash
pnpm --filter @audience/web vitest run components/telao/__tests__/TelaoCommentsFeedSwitcher.test.tsx
```

Expected: 1 test passed.

- [ ] **Step 3: Smoke test manual de não-regressão**

1. Criar evento novo (sem slides)
2. Abrir `/telao/<slug>`
3. Verificar que TelaoClient renderiza igual ao antes (cards um-por-um da fila de aprovação H2R)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/telao/__tests__/TelaoCommentsFeedSwitcher.test.tsx
git commit -m "test(telao): TelaoCommentsFeedSwitcher fallback sem slide"
```

---

### Task 18: Final check — typecheck + lint + full test suite

- [ ] **Step 1: Typecheck**

```bash
pnpm --filter @audience/web typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
pnpm --filter @audience/web lint
```

Expected: 0 errors.

- [ ] **Step 3: Tests**

```bash
pnpm --filter @audience/web test
```

Expected: todos passando (173 + ~6 novos).

- [ ] **Step 4: Build**

```bash
pnpm --filter @audience/web build
```

Expected: build OK, sem warnings novos.

- [ ] **Step 5: PR-ready commit log**

```bash
git log --oneline main..HEAD
```

Revisar mensagens dos commits. Atualizar `docs/wordcloud-followups.md` (ou criar `docs/comments-as-slides.md`) listando follow-ups deixados fora:
- Drag-and-drop livre (sem grid) no spotlight
- Múltiplos comentários simultâneos (galeria) no spotlight
- Animações de transição entre slides

- [ ] **Step 6: Commit final**

```bash
git add docs/comments-as-slides.md 2>/dev/null
git commit -m "docs: follow-ups da feature comentários-como-slide" --allow-empty
```

---

## Self-Review Checklist (preenchido durante escrita do plano)

✅ **Spec coverage:**
- `comments_feed` (card rotativo um-por-um) → Tasks 4–8
- `comment_spotlight` (1 comentário fixo posicionável) → Tasks 9–14
- "Mover na tela onde aparece" via grid 3×3 (MVP) → Task 9 + Task 12
- Drag livre = follow-up explícito (Task 18 step 5)

✅ **Placeholder scan:** zero "TBD/TODO/similar to". Todos os blocos têm código completo. Exceções: pequenos componentes UI (`Modal`, `Button`, `Toggle`, `BackgroundGrid`) referenciados como existentes — se não existirem com esse nome, tarefas instruem a conferir o padrão local e replicar.

✅ **Type consistency:**
- `SpotlightPosition`, `SpotlightSize`, `CommentSpotlightConfig`, `CommentsFeedConfig` definidos em Task 2 e referenciados consistentemente em Tasks 9, 11, 12, 13, 14.
- `setSpotlightSubmission(args)` (Task 15) — shape `{slideId, submissionId, text, authorName}` igual no caller (ModerationQueue) e na server action.
- `DEFAULT_COMMENTS_FEED_CONFIG` / `DEFAULT_COMMENT_SPOTLIGHT_CONFIG` exportados em Task 2, usados em Tasks 4, 6, 9, 13.

---

## Riscos conhecidos

1. **`TelaoClient.config` precisa aceitar campos do CommentsFeedConfig.** Task 6 menciona — se o tipo `TelaoConfig` em `apps/web/lib/telao/config.ts` for restrito, adicionar `showAuthor?: boolean` etc. como opcionais.
2. **`useActiveSlideConfig`** já lida com troca de tipo (open_ended ↔ wordcloud). Verificar (Task 7) que `activeType` aceita os 2 novos valores sem cast.
3. **Migration `add value` é não-transacional no Postgres.** Já provado funcionar no projeto (open_ended). Não precisa de cuidado especial.
4. **RLS:** novo tipo `comments_feed` não cria tabelas — usa `submissions` existente (RLS já testada). `comment_spotlight` também não — snapshot ao escolher.
5. **Realtime:** `slides.UPDATE` já está no publication (Task 6 do plano original do multi-slide). Reage automaticamente.
