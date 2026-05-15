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
  const maxWords = config.maxWordsPerSubmission ?? 1;
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [words, setWords] = useState<string[]>(() => Array(maxWords).fill(''));

  // Quando maxWords muda (operador altera 1↔2↔3 em tempo real), reslice array
  // sem perder o que o user já digitou.
  if (words.length !== maxWords) {
    setWords((prev) => {
      const next = Array(maxWords).fill('');
      for (let i = 0; i < Math.min(prev.length, maxWords); i += 1) next[i] = prev[i] ?? '';
      return next;
    });
  }

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
            setWords(Array(maxWords).fill(''));
            setErrorMsg(null);
          }}
        >
          Mandar outra
        </Button>
      </motion.div>
    );
  }

  const hasAtLeastOne = words.some((w) => w.trim().length > 0);

  const handleSubmit = () => {
    const filled = words.map((w) => w.trim()).filter((w) => w.length > 0);
    if (filled.length === 0) return;
    setErrorMsg(null);
    start(async () => {
      // Envia cada palavra separadamente — o backend agrega contagem por palavra.
      let lastError: string | null = null;
      for (const word of filled) {
        const fd = new FormData();
        fd.set('word', word);
        const result = await submitWord(slug, fd);
        if (!result.ok) {
          lastError = ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown!;
          break;
        }
      }
      if (lastError) {
        setOutcome('error');
        setErrorMsg(lastError);
        return;
      }
      setOutcome('success');
      setWords(Array(maxWords).fill(''));
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-4"
    >
      <p className="text-lg text-ink/80">{config.question}</p>
      {words.map((w, i) => (
        <Input
          key={i}
          label={maxWords === 1 ? 'Sua palavra' : `Palavra ${i + 1}`}
          id={`word-${i}`}
          required={i === 0}
          maxLength={30}
          autoComplete="off"
          value={w}
          onChange={(e) =>
            setWords((prev) => {
              const next = [...prev];
              next[i] = e.target.value;
              return next;
            })
          }
          placeholder="Digite uma palavra"
        />
      ))}
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
        disabled={pending || !hasAtLeastOne}
        className="w-full text-lg h-14"
      >
        {maxWords > 1 ? 'Enviar palavras' : 'Enviar palavra'}
      </Button>
    </form>
  );
}
