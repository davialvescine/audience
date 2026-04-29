type Props = { className?: string; lines?: number };

export function LoadingSkeleton({ className = '', lines = 1 }: Props) {
  return (
    <div role="status" aria-label="Carregando" className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-surface rounded animate-pulse mb-2 last:mb-0" />
      ))}
    </div>
  );
}
