import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function Card({ children, className = '', ...rest }: Props) {
  return (
    <div className={`bg-paper rounded-lg border border-ink/10 shadow-xs p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}
