import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: 'bg-primary text-paper hover:bg-primary-deep',
  accent: 'bg-accent text-ink hover:brightness-95',
  ghost: 'bg-transparent text-ink hover:bg-ink/5',
  danger: 'bg-danger text-paper hover:brightness-90',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-sm',
  md: 'h-11 px-5 text-base rounded-md',
  lg: 'h-14 px-7 text-lg rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className = '', children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {loading ? <span aria-hidden>…</span> : null}
      {children}
    </button>
  );
});
