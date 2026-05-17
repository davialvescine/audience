'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Card } from '@/components/ui/Card';

type SubTab = 'moderacao' | 'telao' | 'compartilhar';

type Props = {
  moderation: ReactNode;
  telao: ReactNode;
  share: ReactNode;
  pendingCount: number;
};

/**
 * Aba "Comentários" — agrupa moderação, config do telão e compartilhar
 * num único contexto, com sub-tabs internas estilo SlidePropsPanel.
 *
 * Antes eram 3 tabs top-level separadas (Moderação · Telão · Compartilhar).
 * Agora viraram sub-tabs aqui pra simplificar a navegação top-level e
 * deixar claro que tudo isso é parte do fluxo de comentários.
 */
export function CommentsTab({ moderation, telao, share, pendingCount }: Props) {
  const [tab, setTab] = useState<SubTab>('moderacao');

  return (
    <div className="space-y-4">
      {/* Sub-tabs pill — mesmo estilo do SlidePropsPanel */}
      <div className="flex items-center gap-1 rounded-full bg-ink/[0.05] p-1 max-w-xl">
        <SubTabButton
          active={tab === 'moderacao'}
          onClick={() => setTab('moderacao')}
          label="Moderação"
          badge={pendingCount > 0 ? String(pendingCount) : null}
        />
        <SubTabButton
          active={tab === 'telao'}
          onClick={() => setTab('telao')}
          label="Telão"
        />
        <SubTabButton
          active={tab === 'compartilhar'}
          onClick={() => setTab('compartilhar')}
          label="Compartilhar"
        />
      </div>

      <div hidden={tab !== 'moderacao'}>{moderation}</div>
      <div hidden={tab !== 'telao'}>{telao}</div>
      <div hidden={tab !== 'compartilhar'}>
        {share}
        <div className="mt-4">
          <Card>
            <h3 className="font-display text-lg mb-2">Convidar moderadores</h3>
            <p className="text-sm text-ink/70 mb-3">
              Quer mais alguém moderando junto com você? Convide pela página de usuários.
            </p>
            <Link href="/admin/users" className="inline-block text-sm text-primary hover:underline">
              Ir pra Usuários →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-8 rounded-full text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 ${
        active ? 'bg-paper text-ink shadow-sm' : 'text-ink/55 hover:text-ink/80'
      }`}
    >
      {label}
      {badge ? (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-paper text-[10px] font-bold">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
