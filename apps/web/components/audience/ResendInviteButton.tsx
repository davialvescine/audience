'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { resendInvite } from '@/server-actions/resendInvite';

export function ResendInviteButton({ email }: { email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending || status === 'sent'}
        onClick={() => {
          setStatus('idle');
          setErrorMsg(null);
          start(async () => {
            const r = await resendInvite(email);
            if (r.ok) {
              setStatus('sent');
              router.refresh();
            } else {
              setStatus('error');
              setErrorMsg(r.error);
            }
          });
        }}
        className="text-xs px-2 py-1 rounded-sm border border-ink/15 text-ink/70 hover:bg-ink/5 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Reenviando…' : status === 'sent' ? '✓ Reenviado' : 'Reenviar'}
      </button>
      {status === 'error' && errorMsg ? (
        <span role="alert" className="text-xs text-danger">
          {errorMsg}
        </span>
      ) : null}
    </div>
  );
}
