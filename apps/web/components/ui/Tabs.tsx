'use client';

import { useEffect, useState, type ReactNode } from 'react';

type Tab = { id: string; label: string; content: ReactNode };
type Props = { tabs: Tab[]; defaultTabId?: string };

export function Tabs({ tabs, defaultTabId }: Props) {
  // Persiste tab ativa na URL (?tab=slides). Sobrevive a revalidatePath,
  // permite deep-link e mantém tab selecionada após server actions.
  // Antes: state local resetava pro tabs[0] quando o componente remontava
  // (ex: ao editar slide, server action revalidava → state perdido →
  // usuário "voltava pra Comentários" sozinho).
  const initial = (() => {
    if (typeof window === 'undefined') return defaultTabId ?? tabs[0]?.id ?? '';
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) return fromUrl;
    return defaultTabId ?? tabs[0]?.id ?? '';
  })();
  const [active, setActive] = useState(initial);

  // Reflete tab → URL sem disparar navegação. Apenas replaceState pra
  // que F5 e revalidatePath preservem a tab. Não dispara router push
  // pra não re-renderizar a página inteira.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') !== active) {
      url.searchParams.set('tab', active);
      window.history.replaceState(null, '', url.toString());
    }
  }, [active]);

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex border-b border-ink/15 mb-6 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.id === activeTab?.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition relative ${
                isActive ? 'text-primary' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {t.label}
              {isActive ? (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          hidden={t.id !== activeTab?.id}
          style={t.id === activeTab?.id ? undefined : { display: 'none' }}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
