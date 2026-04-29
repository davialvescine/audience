import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  helper?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, helper, id, className = '', ...rest },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper ? `${id}-helper` : undefined;
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className={`mt-1 block w-full h-11 px-3 rounded-md border border-ink/20 bg-paper text-ink placeholder:text-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-danger' : ''} ${className}`}
        {...rest}
      />
      {helper ? (
        <span id={helperId} className="mt-1 block text-xs text-ink/60">
          {helper}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});
