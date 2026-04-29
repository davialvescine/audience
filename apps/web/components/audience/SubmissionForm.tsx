'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { submitComment } from '@/server-actions/submitComment';

type Props = { slug: string };

export function SubmissionForm({ slug }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');

  if (success) {
    return (
      <div role="status" className="text-center p-6 bg-paper rounded-lg shadow-sm">
        <h2 className="text-2xl font-display text-primary">Recebido!</h2>
        <p className="mt-2 text-ink/70">Seu comentário foi enviado e pode aparecer no telão.</p>
      </div>
    );
  }

  return (
    <form
      action={(formData: FormData) => {
        setError(null);
        start(async () => {
          const result = await submitComment(slug, formData);
          if (!result.ok) setError(result.error);
          else {
            setSuccess(true);
            setName('');
            setComment('');
          }
        });
      }}
      className="space-y-4"
    >
      <Input
        label="Seu nome"
        id="name"
        name="name"
        required
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Como você quer aparecer no telão"
      />
      <Textarea
        label="Sua mensagem"
        id="comment"
        name="comment"
        required
        maxLength={280}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escreva aqui…"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Enviar
      </Button>
    </form>
  );
}
