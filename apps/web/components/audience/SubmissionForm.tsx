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
      <div role="status" className="text-center py-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
          <svg
            className="h-8 w-8 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-display text-primary mb-2">Recebido!</h2>
        <p className="text-ink/70 mb-6">
          Sua mensagem foi enviada. Pode aparecer no telão a qualquer momento.
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setSuccess(false);
            setName('');
            setComment('');
          }}
        >
          Mandar outra
        </Button>
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
        autoComplete="given-name"
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
        rows={4}
      />
      {error ? (
        <div role="alert" className="p-3 rounded-md bg-danger/10 text-danger text-sm">
          {error}
        </div>
      ) : null}
      <Button
        type="submit"
        variant="accent"
        size="lg"
        loading={pending}
        className="w-full text-lg h-14"
      >
        Enviar mensagem
      </Button>
    </form>
  );
}
