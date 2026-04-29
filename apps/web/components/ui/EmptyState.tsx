import type { ReactNode } from 'react';

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div role="status" className="text-center py-12 px-4">
      {icon ? <div className="mx-auto mb-4 text-ink/40">{icon}</div> : null}
      <h2 className="text-lg font-display font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-2 text-sm text-ink/60">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
