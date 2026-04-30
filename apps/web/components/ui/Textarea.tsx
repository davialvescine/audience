import { forwardRef, type TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  helper?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, error, helper, id, value, maxLength, className = '', ...rest },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper ? `${id}-helper` : undefined;
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea
        ref={ref}
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className={`mt-1 block w-full min-h-32 px-3 py-2 rounded-md border border-ink/20 bg-paper text-ink placeholder:text-ink/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-danger' : ''} ${className}`}
        {...rest}
      />
      <div className="mt-1 flex justify-between text-xs">
        <span id={helperId} className="text-ink/60">
          {helper}
        </span>
        {maxLength ? (
          <span className="text-ink/60">
            {length} / {maxLength}
          </span>
        ) : null}
      </div>
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});
