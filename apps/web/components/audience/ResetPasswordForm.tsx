'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (password.length < 8) {
          setError('A senha precisa ter pelo menos 8 caracteres.');
          return;
        }
        if (password !== confirm) {
          setError('As senhas não coincidem.');
          return;
        }
        start(async () => {
          const supabase = getSupabaseBrowserClient();
          const { error: updateErr } = await supabase.auth.updateUser({
            password,
            data: { password_set: true },
          });
          if (updateErr) {
            setError(updateErr.message);
            return;
          }
          router.push('/admin/events');
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <Input
        label="Nova senha"
        id="password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        helper="Mínimo 8 caracteres"
      />
      <Input
        label="Confirme a senha"
        id="confirm"
        type="password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full">
        Salvar nova senha
      </Button>
    </form>
  );
}
