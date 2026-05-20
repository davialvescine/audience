'use client';

import { motion } from 'framer-motion';
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
      <motion.div
        role="status"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center py-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
          className="mx-auto mb-4 h-16 w-16 rounded-full bg-success/15 flex items-center justify-center"
        >
          <svg
            className="h-8 w-8 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-display text-primary mb-2"
        >
          Recebido!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-ink/70 mb-6"
        >
          Sua mensagem foi enviada. Pode aparecer no telão a qualquer momento.
        </motion.p>
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
      </motion.div>
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
        label="Seu nome (opcional)"
        id="name"
        name="name"
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Deixe em branco pra enviar como Anônimo"
        autoComplete="given-name"
      />
      <Textarea
        label="Sua mensagem"
        id="comment"
        name="comment"
        required
        maxLength={150}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escreva aqui…"
        rows={4}
      />
      {error ? (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-md bg-danger/10 text-danger text-sm"
        >
          {error}
        </motion.div>
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
      <Button
        type="button"
        variant="ghost"
        size="md"
        disabled={pending || comment.trim().length === 0}
        onClick={() => {
          setError(null);
          start(async () => {
            const fd = new FormData();
            fd.set('name', ''); // validator converte vazio → 'Anônimo'
            fd.set('comment', comment);
            const result = await submitComment(slug, fd);
            if (!result.ok) setError(result.error);
            else {
              setSuccess(true);
              setName('');
              setComment('');
            }
          });
        }}
        className="w-full"
        title="Envia a mensagem com nome 'Anônimo'"
      >
        Enviar como Anônimo
      </Button>
    </form>
  );
}
