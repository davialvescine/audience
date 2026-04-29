'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { inviteUser } from '@/server-actions/inviteUser';

export function InviteUserForm() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <form
      action={() => {
        setError(null);
        setSuccess(false);
        start(async () => {
          const r = await inviteUser(email);
          if (r.ok) {
            setSuccess(true);
            setEmail('');
          } else {
            setError(r.error);
          }
        });
      }}
      className="space-y-4"
    >
      <Input
        label="Email do novo usuário"
        id="invite-email"
        name="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="exemplo@gmail.com"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-success">✓ Convite enviado! O usuário receberá um email pra criar a senha.</p>
      ) : null}
      <Button type="submit" loading={pending}>
        Enviar convite
      </Button>
    </form>
  );
}
