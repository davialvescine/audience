'use client';

import { useState, type ReactNode } from 'react';

type Tab = { id: string; label: string; content: ReactNode };
type Props = { tabs: Tab[]; defaultTabId?: string };

export function Tabs({ tabs, defaultTabId }: Props) {
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id ?? '');
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
                isActive
                  ? 'text-primary'
                  : 'text-ink/60 hover:text-ink'
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
