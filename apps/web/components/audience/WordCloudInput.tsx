'use client';

import { motion } from 'framer-motion';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { submitWord } from '@/server-actions/submitWord';

type Props = {
  slug: string;
  config: WordcloudConfig;
};

type Outcome = 'idle' | 'success' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Aguarde alguns segundos antes de enviar de novo.',
  profanity: 'Palavra não aceita. Tenta outra.',
  too_long: 'Sua palavra é muito longa. Use até 30 caracteres.',
  wordcloud_inactive: 'A nuvem foi pausada pelo apresentador.',
  event_not_found: 'Este evento não foi encontrado.',
  unknown: 'Não foi possível enviar. Tente novamente.',
};

export function WordCloudInput({ slug, config }: Props) {
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [word, setWord] = useState('');

  if (outcome === 'success') {
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
          Sua palavra entrou na nuvem. Acompanhe o telão!
        </motion.p>
        <Button
          variant="ghost"
          onClick={() => {
            setOutcome('idle');
            setWord('');
            setErrorMsg(null);
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
        const value = String(formData.get('word') ?? '').trim();
        if (!value) return;
        setErrorMsg(null);
        start(async () => {
          const result = await submitWord(slug, formData);
          if (!result.ok) {
            setOutcome('error');
            setErrorMsg(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown!);
            return;
          }
          setOutcome('success');
          setWord('');
        });
      }}
      className="space-y-4"
    >
      <p className="text-lg text-ink/80">{config.question}</p>
      <Input
        label="Sua palavra"
        id="word"
        name="word"
        required
        maxLength={30}
        autoComplete="off"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Digite uma palavra"
      />
      {errorMsg ? (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-md bg-danger/10 text-danger text-sm"
        >
          {errorMsg}
        </motion.div>
      ) : null}
      <Button
        type="submit"
        variant="accent"
        size="lg"
        loading={pending}
        disabled={pending || !word.trim()}
        className="w-full text-lg h-14"
      >
        Enviar palavra
      </Button>
    </form>
  );
}
