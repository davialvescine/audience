# Telão — Modos de exibição (multi-saída)

**Data:** 2026-04-30
**Status:** Plano para revisão

## Objetivo

Permitir que cada evento escolha **um ou mais** modos de exibição dos comentários no telão, sem depender exclusivamente do H2R Graphics. Quatro modos suportados, todos opcionais e independentes:

1. **H2R Graphics** (atual, mantido)
2. **Browser Source** (OBS, vMix, Streamlabs, Wirecast, Ecamm Live, mimoLive, CasparCG — qualquer software com suporte a Web Source)
3. **Chrome PiP** (Document Picture-in-Picture API — janela flutuante always-on-top em Chrome/Edge/Brave)
4. **Audience Desktop** (app Tauri proprietário com janela transparente always-on-top, otimizado pra macOS via workaround Swift)

Todos os modos consomem a mesma fonte de dados (Supabase Realtime) e podem rodar em paralelo. Operador pode usar H2R em um evento e Browser Source em outro, ou ambos no mesmo evento.

---

## Princípios

- **Mesma página, múltiplos transportes**: `/telao/[slug]` é a base. Browser Source carrega ela diretamente. Chrome PiP abre ela numa janela secundária. Desktop App embute ela num WebView transparente. Lógica de renderização e Realtime ficam num lugar só.
- **H2R intocado**: toda a stack atual (Bridge CLI, pairing, RPCs) continua funcionando. Não removemos nada.
- **Customização universal**: todas as opções (cor, fonte, posição, animação, tempo) ficam num único `events.telao_config` JSONB. Editor visual no admin com preview ao vivo. As mesmas configs valem pros 4 modos.
- **Auto-distribuição**: instaladores do Audience Desktop hospedados no próprio sistema (`/downloads/desktop/mac` e `/downloads/desktop/win`), buscando releases do GitHub.
- **Documentação interna**: cada modo tem página `/admin/help/<mode>` com tutorial passo a passo, vídeo embutido e screenshots — operador não precisa abrir doc externa.

---

## Schema (migration nova)

`supabase/migrations/00120000_telao_modes.sql`:

```sql
-- 00120000_telao_modes.sql

create type public.telao_display_mode as enum ('h2r', 'browser_source', 'chrome_pip', 'desktop_app');

alter table public.events
  add column if not exists enabled_display_modes
    public.telao_display_mode[] not null default array['h2r']::public.telao_display_mode[];

alter table public.events
  add column if not exists telao_config jsonb not null default jsonb_build_object(
    'position', 'bottom-center',
    'width_pct', 90,
    'fontFamily', 'Inter',
    'fontSizePx', 32,
    'cardBg', 'rgba(10, 37, 64, 0.85)',
    'cardText', '#FFFFFF',
    'borderRadius', 16,
    'shadow', 'medium',
    'backdropBlur', 8,
    'animation', 'slide-up',
    'displaySeconds', 7,
    'maxConcurrent', 1,
    'showAvatar', false,
    'showTimestamp', false,
    'showEventName', false
  );

comment on column public.events.enabled_display_modes is
  'Lista de modos de exibição habilitados pra esse evento. Pode usar múltiplos simultâneos.';
comment on column public.events.telao_config is
  'Configuração visual do telão: posição, tamanho, cores, animação, etc. Aplicada pros 4 modos.';
```

---

## Página `/telao/[slug]`

Server Component carrega config + theme do evento. Client Component faz Realtime + render + animações.

`apps/web/app/telao/[slug]/page.tsx`:
- Lê `events.telao_config`, `events.theme_id`, `events.name`
- Passa pra `<TelaoClient>` que é client component

`apps/web/components/telao/TelaoClient.tsx`:
- Subscribes a `submissions` filtrado por `event_id` e `status=sent`
- Mantém fila local de mensagens não exibidas
- Renderiza com posição/tamanho/animação vindo da config
- CSS root: `background: transparent !important; overflow: hidden;`

CSS-vars dinâmicas vindo da config:
```ts
const style = {
  '--telao-card-bg': config.cardBg,
  '--telao-card-text': config.cardText,
  '--telao-font-size': `${config.fontSizePx}px`,
  '--telao-radius': `${config.borderRadius}px`,
  '--telao-blur': `${config.backdropBlur}px`,
} as React.CSSProperties;
```

Animações: `slide-up | slide-down | slide-left | slide-right | fade | scale | bounce` — implementadas com Framer Motion.

Posições suportadas: `top-left | top-center | top-right | middle-left | center | middle-right | bottom-left | bottom-center | bottom-right` + custom `{x: number, y: number}` em %.

---

## Aba "Telão" no admin

Nova aba dentro de `/admin/events/[slug]`, ao lado de Moderação · Conexão H2R · Compartilhar · Configurações.

Layout em 2 colunas:

**Esquerda (controles):**
- Toggle multi-select dos 4 modos de exibição (checkbox grupo)
- Editor visual com seções:
  - **Posição** (grid 3×3 de botões com ícones + custom X/Y)
  - **Tamanho** (slider largura, slider font-size)
  - **Cores** (color picker fundo/texto + opacidade)
  - **Estilo** (radius slider, shadow preset, blur slider)
  - **Animação** (preset selector com preview)
  - **Tempo** (slider seconds, slider max simultâneos)
  - **Extras** (toggles avatar / timestamp / nome do evento)

**Direita (preview ao vivo):**
- Iframe com `/telao/[slug]?preview=1` mostrando uma mensagem de exemplo aplicando as configs em tempo real
- Botão "Disparar mensagem teste" pra ver animação

Cada modo selecionado adiciona um card "Como configurar" abaixo, com link pra `/admin/help/<mode>`.

---

## Modo 1: H2R Graphics (mantido)

Sem mudanças. Aba "Conexão H2R" continua aparecendo se modo `h2r` estiver habilitado.

---

## Modo 2: Browser Source (universal pra OBS / vMix / Streamlabs / etc)

### O que o operador vê

Card no editor:
> **Browser Source** — Cole o link no software de produção (OBS, vMix, Streamlabs, Wirecast).
>
> URL: `https://audience.app/telao/<slug>` [📋 Copiar]
>
> [📥 Baixar cena pronta] (gera `.json` ou `.vmix` baseado no software escolhido)
>
> [📖 Como configurar no OBS] [📖 Como configurar no vMix] [📖 Streamlabs] [📖 Wirecast]

### Endpoints

- `GET /api/scene/obs/<slug>` → retorna `.json` de Scene Collection do OBS pré-configurado com Browser Source apontando pro `/telao/<slug>` em 1920×1080 transparente
- `GET /api/scene/vmix/<slug>` → retorna `.vmix` (XML) com input Browser configurado
- `GET /api/scene/streamlabs/<slug>` → retorna `.json` Streamlabs

### Tutoriais embutidos (`/admin/help/browser-source`)

Por software (cada um com 5-6 screenshots + vídeo curto):

**OBS:**
1. Abra OBS Studio (download em obsproject.com)
2. Cena → Importar Coleção de Cenas → seleciona o `.json` baixado
3. Adicione sua apresentação como Captura de Janela
4. Direito no preview → Projetor de Tela Cheia → escolha o monitor do projetor

**vMix:**
1. Abra vMix
2. Add Input → Web Browser → cola URL
3. Crie cena com apresentação + browser
4. Output → Fullscreen

**Streamlabs:**
1. Add Source → Browser Source → cola URL
2. Width 1920, Height 1080, marca "Shutdown source when not visible"
3. Studio Mode → Fullscreen Projector

**Wirecast:**
1. New Source → Web Page → cola URL
2. Layer → adiciona em cima da apresentação
3. Output → External Display

---

## Modo 3: Chrome PiP (Document Picture-in-Picture)

### O que o operador vê

Card no editor:
> **Chrome PiP** — Janela flutuante always-on-top, funciona em qualquer apresentação fullscreen.
>
> Pré-requisito: Chrome, Edge ou Brave (Safari/Firefox não suportam ainda)
>
> [🪟 Abrir como janela flutuante] (botão grande)
>
> [📖 Como funciona]

### Implementação técnica

Em `/telao/[slug]`, detectar suporte:

```ts
const supportsDocPip = 'documentPictureInPicture' in window;
```

Se suporta, mostrar overlay sutil com botão "Abrir como janela flutuante" que chama:

```ts
const pipWindow = await documentPictureInPicture.requestWindow({
  width: telaoConfig.pip_width || 600,
  height: telaoConfig.pip_height || 200,
});

// Copiar CSS do documento principal
[...document.styleSheets].forEach((sheet) => {
  try {
    const link = pipWindow.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = sheet.href!;
    pipWindow.document.head.appendChild(link);
  } catch (e) { /* inline styles */ }
});

// Mover root do telão pra janela PiP
const root = document.querySelector('#telao-root')!;
pipWindow.document.body.appendChild(root);
```

Persistir tamanho/posição em `localStorage` por slug.

### Tutorial (`/admin/help/chrome-pip`)

1. No computador da apresentação, abra Chrome
2. Vá em `audience.app/telao/<slug>`
3. Clique "Abrir como janela flutuante"
4. Arraste a janelinha pro canto desejado
5. Inicie sua apresentação normalmente — a janelinha fica por cima

---

## Modo 4: Audience Desktop (app Tauri proprietário)

### Visão

App Tauri 2 que abre uma janela:
- Transparente
- Sem decorações (sem barra de título)
- Always-on-top (nível de janela = `screen-saver` ou superior)
- Sem aparecer no Dock/Taskbar
- macOS: workaround Swift pra ficar por cima de fullscreen apps

Usuário abre o app, cola o slug do evento (ou URL completa), app embute `/telao/<slug>` num WebView transparente. Configurações continuam vindo do servidor.

### Estrutura no monorepo

`packages/audience-desktop/`:
```
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── macos.rs        # Swift FFI bridge
│   ├── macos/
│   │   └── overlay.swift   # NSWindow level helpers
│   ├── tauri.conf.json
│   └── Cargo.toml
├── src/
│   ├── App.tsx             # Form pra colar URL + abrir telão
│   └── main.tsx
└── package.json
```

### Configuração Tauri

`tauri.conf.json` (resumido):
```json
{
  "app": {
    "windows": [{
      "title": "Audience Telão",
      "width": 1920,
      "height": 1080,
      "transparent": true,
      "decorations": false,
      "alwaysOnTop": true,
      "skipTaskbar": true,
      "shadow": false,
      "fullscreen": false,
      "visible": false
    }]
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "nsis"],
    "macOS": { "minimumSystemVersion": "11.0" },
    "windows": { "wix": null }
  }
}
```

### macOS — workaround Swift pra ficar acima de fullscreen

O problema: por padrão, janelas Tauri (NSWindow) ficam abaixo de apps em fullscreen exclusivo (Keynote Play Slideshow, PowerPoint Slide Show).

A solução: configurar `NSWindow.collectionBehavior` e `NSWindow.level` pra ficar acima. Tauri permite chamar código nativo via plugin custom ou Rust→ObjC FFI.

`packages/audience-desktop/src-tauri/macos/overlay.swift`:

```swift
import Cocoa

@_cdecl("audience_overlay_promote_window")
public func audienceOverlayPromoteWindow(rawPtr: UnsafeMutableRawPointer) {
    let nsWindow = Unmanaged<NSWindow>.fromOpaque(rawPtr).takeUnretainedValue()

    // Nível: maior que screen-saver, mas abaixo de cursor
    nsWindow.level = NSWindow.Level(rawValue: Int(CGShieldingWindowLevel()) - 1)

    // Collection behavior: aparece em todos Spaces, inclusive fullscreen
    nsWindow.collectionBehavior = [
        .canJoinAllSpaces,
        .fullScreenAuxiliary,
        .stationary,
        .ignoresCycle
    ]

    // Não roubar foco
    nsWindow.styleMask.insert(.nonactivatingPanel)
    nsWindow.hidesOnDeactivate = false

    // Click-through opcional — descomenta se quiser que cliques passem pra apresentação
    // nsWindow.ignoresMouseEvents = true
}
```

`src-tauri/src/macos.rs`:

```rust
#[cfg(target_os = "macos")]
pub fn promote_window(window: &tauri::WebviewWindow) {
    use cocoa::base::id;
    use objc::runtime::Object;

    let ns_window = window.ns_window().unwrap() as *mut Object;
    extern "C" {
        fn audience_overlay_promote_window(window: *mut Object);
    }
    unsafe {
        audience_overlay_promote_window(ns_window);
    }
}
```

`src-tauri/src/main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(target_os = "macos")]
            crate::macos::promote_window(&window);
            window.show().unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![/* commands */])
        .run(tauri::generate_context!())
        .expect("error");
}
```

`build.rs` linka o Swift:
```rust
fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("macos/overlay.swift")
            .flag("-fmodules")
            .compile("audience_overlay");
        println!("cargo:rustc-link-lib=framework=Cocoa");
    }
}
```

**Status realístico:** apps que conseguem isso (Discord overlay, Spotify Lyrics, OBS) usam exatamente esse padrão. Funciona pra Keynote/PowerPoint fullscreen modernos. Pode haver edge cases (Mission Control switching) — testaremos.

### Windows — bem mais simples

`alwaysOnTop: true` no Tauri já funciona. Sem código nativo.

### Auto-update via Tauri Updater

```json
"plugins": {
  "updater": {
    "active": true,
    "endpoints": ["https://audience.app/api/updates/desktop/{{target}}/{{current_version}}"],
    "pubkey": "..."
  }
}
```

Endpoint `/api/updates/desktop/[target]/[version]/route.ts` consulta GitHub Releases e retorna o latest com signature.

### Distribuição

GitHub Actions builda no push de tag:
- `audience-desktop-v0.1.0-macos-aarch64.dmg` (Apple Silicon)
- `audience-desktop-v0.1.0-macos-x64.dmg` (Intel)
- `audience-desktop-v0.1.0-windows-x64.msi`

Audience hospeda os downloads:
- `GET /downloads/desktop/mac` → redireciona pro `.dmg` mais recente
- `GET /downloads/desktop/win` → redireciona pro `.msi` mais recente

Página `/admin/help/desktop-app`:
> **Audience Desktop** — App nativo, sem precisar de OBS.
>
> [📥 Baixar pra Mac (Apple Silicon)] [📥 Baixar pra Mac (Intel)] [📥 Baixar pra Windows]
>
> 1. Baixe e instale (Mac: arrasta pra Applications. Win: roda o .msi)
> 2. Abra "Audience Telão" no Spotlight/Menu Iniciar
> 3. Cole a URL do telão: `audience.app/telao/<slug>`
> 4. Clique "Abrir Telão"
> 5. Inicie sua apresentação normalmente — o telão fica por cima

---

## Aba Help (sistema de ajuda interno)

Nova rota `/admin/help/[mode]` com:

- Página dedicada por modo: `h2r`, `browser-source`, `chrome-pip`, `desktop-app`
- Em cada uma:
  - Resumo (1 parágrafo)
  - Vídeo embutido (Loom/YouTube unlisted)
  - Tutorial passo a passo com screenshots
  - FAQ (5 perguntas comuns)
  - Botão "Pedir ajuda no WhatsApp" (link `wa.me/...`)
- Link cross-cuting: dentro do editor de Telão, cada modo selecionado tem botão "Como configurar →"

---

## Tabela comparativa pro operador escolher

Renderizada na aba Telão como referência rápida:

| Modo | Custo | Instalação | Funciona com Mac fullscreen | Apresentação fullscreen | Recomendado pra... |
|---|---|---|---|---|---|
| H2R Graphics | $$ pago | H2R + Bridge CLI | ✅ | ✅ | Quem já tem H2R |
| Browser Source (OBS) | Grátis | OBS Studio | ✅ via Display Capture | ✅ | Streamers, transmissão |
| Chrome PiP | Grátis | Nada | ✅ (Document PiP funciona) | ✅ janelinha | Operador casual, 1 clique |
| Audience Desktop | Grátis | Nosso `.dmg`/`.msi` | ✅ via Swift workaround | ✅ tela cheia | Setup permanente, sem 3rd party |

---

## Cronograma e fases

### Phase 1 (foundation) — 2 dias
- Migration `00120000_telao_modes.sql`
- Página `/telao/[slug]` básica com Realtime + bg transparente + lower-third estático
- Aba "Telão" no admin com toggle de modos + editor visual minimal (apenas posição + cor)
- Help route stub `/admin/help/[mode]`

### Phase 2 (Browser Source) — 1 dia
- Endpoint `/api/scene/obs/[slug]` (gera `.json`)
- Endpoint `/api/scene/vmix/[slug]` (gera `.xml`)
- Endpoint `/api/scene/streamlabs/[slug]` (gera `.json`)
- Páginas `/admin/help/browser-source` com tutoriais (OBS, vMix, Streamlabs, Wirecast)
- Botões de download no editor

### Phase 3 (Chrome PiP) — 1 dia
- Detect Document PiP API
- Botão "Abrir como janela flutuante" + lógica de movimento do root
- Persistir tamanho/posição em localStorage
- Página `/admin/help/chrome-pip`

### Phase 4 (Editor visual completo + preview) — 2 dias
- Sliders, color pickers, animation preview
- Iframe lateral com preview ao vivo (`?preview=1` mode)
- Botão "Disparar mensagem teste"
- Persistência em `events.telao_config`

### Phase 5 (Audience Desktop — Tauri base) — 3 dias

**MVP recommendation (decided 2026-04-29 with user):** ship Phase 5 + 7 first (~2 dias úteis), skip Phase 6 Swift workaround until real user demand. MVP covers:
- ✅ Windows fullscreen presentations (Tauri alwaysOnTop just works)
- ✅ Mac with PowerPoint/Keynote in window mode (not Play Slideshow)
- ✅ Mac with presentations on second monitor while overlay on primary
- ❌ Mac with Keynote/PowerPoint in fullscreen exclusive (needs Phase 6 — defer)

Tasks for MVP:
- Setup `packages/audience-desktop/` com Tauri 2 + React (`cargo create-tauri-app`)
- tauri.conf.json: `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`
- Form UI pra colar URL do telão (input + botão "Abrir")
- WebView carrega `/telao/<slug>?mode=desktop_app`
- Build pipeline (Mac DMG Apple Silicon + Intel + Win MSI) via GitHub Actions, **sem assinatura** (user → Open Anyway no Mac, SmartScreen no Win)

### Phase 6 (Mac Swift workaround) — 2 dias
- Implementar `overlay.swift` + Rust FFI
- Testar com Keynote Play Slideshow + PowerPoint Slide Show
- Iterar até overlay ficar por cima consistentemente

### Phase 7 (Auto-update + distribuição) — 1 dia
- Endpoint `/api/updates/desktop/[target]/[version]`
- Endpoints `/downloads/desktop/mac` e `/downloads/desktop/win` (redirect pra GitHub Releases)
- Página `/admin/help/desktop-app` com botões de download

### Phase 8 (Polimento + tutoriais) — 1 dia
- Vídeos curtos (60-90s) por modo
- Screenshots refinados
- FAQ
- Botão WhatsApp/Discord support

**Total: ~13 dias úteis de dev**

---

## Decisões em aberto pra confirmar

1. **Modo único vs múltiplo simultâneo:** evento pode ter `[h2r, browser_source]` ativos ao mesmo tempo? (proposto: sim, multi)
2. **Vídeos tutoriais:** gravo eu mesmo (Loom screen capture, voz off em PT-BR) ou linkamos vídeos externos do OBS/vMix?
3. **WhatsApp suporte:** qual número entra como `wa.me/...`?
4. **Chrome PiP fallback:** se navegador não suporta, mostra modal "instale Chrome" ou redireciona pra Browser Source?
5. **Audience Desktop nome do binário:** `Audience Telão.app`, `Audience.app`, ou `Audience Desktop.app`?
6. **Auto-update do desktop:** ativo desde dia 1 ou só após ter 2-3 versões publicadas?

---

## Riscos identificados

- **Mac fullscreen Swift:** apesar do padrão ser conhecido, cada release do macOS pode quebrar. Mitigação: testar em macOS 14, 15 atual; manter eu testando em betas.
- **Dev/distribuição do Tauri:** code signing Apple requer Apple Developer ID ($99/ano). Sem ele, usuário precisa "abrir mesmo assim" via Sistema → Privacidade. **Decidir se vale.**
- **Document PiP em Chrome:** API estável desde Chrome 116 (2023), mas usuário com Chrome muito antigo não roda. Detectar e mostrar fallback claro.
- **Browser Source no Mac:** OBS no Apple Silicon ocasionalmente tem bugs em Display Capture (resolúveis via permissões). Documentar.

---

**Próximo passo:** sua revisão. Confirme os 6 itens em "Decisões em aberto" e eu inicio Phase 1.

---

## Phase 9 (futuro) — NDI (Network Device Interface)

**Adicionado em 2026-04-30 a pedido do Davi.** Não é prioridade imediata — só faz sentido depois que o Audience Desktop estiver maduro e se aparecer demanda real (estúdios profissionais, multi-câmera).

### Por que adicionar NDI

NDI é o padrão de transporte de vídeo em redes locais (Newtek). Vantagens:
- Estúdios profissionais já têm receptores NDI (vMix, Wirecast, Tricaster)
- Funciona em LAN — operador da apresentação roda nosso Audience Desktop, NDI source aparece na rede, vMix/Tricaster captura e mixa
- Suporte a alpha channel (transparência) — overlay puro
- Latência baixa (~30-100ms LAN)

### Caminhos técnicos avaliados

**A. node-ndi nativo no Tauri sidecar** (recomendado se for adiante)
- Tauri spawna um sidecar Node que usa `node-ndi` (binding nativo do NDI SDK)
- Audience Desktop renderiza overlay transparente offscreen (canvas ou OffscreenCanvas) e empurra frames via NDI
- Pro: integrado ao app desktop; sem dependência externa
- Contra: NDI SDK precisa ser baixado/incluído no bundle (licença NDI permite redistribuição mas é grande); empacotamento complica

**B. OBS-NDI plugin (free) como bridge** (mais simples, depende do operador)
- Operador instala plugin obs-ndi (https://github.com/Palakis/obs-ndi)
- Configura nossa Browser Source como cena
- Plugin exporta a cena como NDI source automaticamente
- Pro: zero código nosso; funciona já hoje
- Contra: depende de OBS — não é "produto único"

**C. Web → NDI via Sienna NDI Webcam Input** (pago)
- Software de terceiro que captura janela do browser e exporta como NDI
- ~$60 licença
- Descartado pelo custo

### Implementação proposta (caminho A, quando for hora)

```
packages/audience-desktop/
├── src-tauri/
│   ├── src/
│   │   ├── ndi.rs              # FFI Rust ↔ NDI SDK
│   │   └── ndi_sender.rs       # Spawns sender thread, accepts frames from webview
│   └── ndi/
│       └── (NDI SDK headers + libs por plataforma)
└── src/
    └── ndi-bridge.ts           # Captura canvas do telão, envia frames pro sender Rust via Tauri command
```

**Fluxo:**
1. Usuário liga toggle "Exportar via NDI" no app desktop
2. Audience Desktop captura o overlay frame-a-frame (60fps) usando `OffscreenCanvas` + `ImageBitmap`
3. Frames vão pro Rust via `invoke('ndi_send_frame', { rgba: ... })`
4. Rust feeds frames pro NDI SDK
5. Receptor (vMix etc.) detecta source `Audience — <evento>` na rede

**Tempo estimado:** 5-7 dias adicionais ao Audience Desktop base.

### Tarefas

- **Task 9.1:** Pesquisar empacotamento do NDI SDK (Mac universal binary + Win .dll), licença de redistribuição
- **Task 9.2:** Adicionar dependência Rust `cidre` ou crate equivalente que faça FFI pro NDI
- **Task 9.3:** Toggle "NDI Out" na UI do Audience Desktop + persistência local
- **Task 9.4:** Loop de captura do canvas → ImageBitmap → Uint8Array RGBA
- **Task 9.5:** Teste com vMix e OBS-NDI receivers em LAN
- **Task 9.6:** Documentação `/admin/help/ndi.md` com setup vMix
- **Task 9.7:** Adicionar `ndi` como 5º modo em `enabled_display_modes` enum (migration)

### Riscos

- Empacotamento do NDI SDK aumenta o `.dmg` em ~30-50MB
- Licença NDI redistributable exige incluir aviso e link Newtek
- Performance: 60fps de canvas grande pode estourar CPU em máquinas modestas (Apple M1 base aguenta tranquilo, mas operador igreja pode ter MacBook Air 2017)
- Sincronização de frame com a animação Framer Motion: pode haver jitter se não capturar via `requestAnimationFrame`

### Quando ativar

Não antes de:
1. Audience Desktop base funcionando em produção
2. Pelo menos 3 eventos rodando o app desktop sem bugs
3. Pedido explícito de cliente com setup NDI
