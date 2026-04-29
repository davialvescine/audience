import type { SubmissionStatus } from '@audience/shared-types';
import type { ReactNode } from 'react';

const map: Record<SubmissionStatus, { label: string; cls: string }> = {
  pending: { label: 'Aguardando', cls: 'bg-surface text-ink' },
  approved: { label: 'Aprovado', cls: 'bg-secondary/15 text-secondary' },
  rejected: { label: 'Rejeitado', cls: 'bg-danger/15 text-danger' },
  sent: { label: 'No telão', cls: 'bg-success/15 text-success' },
  failed: { label: 'Falhou', cls: 'bg-danger/15 text-danger' },
};

export function Badge({ status }: { status: SubmissionStatus }) {
  const { label, cls } = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${cls}`}>{label}</span>
  );
}

export function CustomBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${className}`}>{children}</span>;
}
