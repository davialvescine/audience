import type { ReactNode } from 'react';

type Props = { title: string; subtitle?: string; children?: ReactNode };

export function BrandHeader({ title, subtitle, children }: Props) {
  return (
    <header className="bg-gradient-to-b from-primary to-accent text-paper px-6 py-10 md:py-14">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-lg opacity-90">{subtitle}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </header>
  );
}
