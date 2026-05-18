'use client';

import { useEffect, useState } from 'react';

import type { PollConfig } from '@/lib/slides/types';
import { submitPollVote } from '@/server-actions/poll';

const FP_KEY = 'audience:fp';

function getOrCreateFp(): string {
  if (typeof window === 'undefined') return '';
  let fp = window.localStorage.getItem(FP_KEY);
  if (!fp) {
    fp =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(FP_KEY, fp);
  }
  return fp;
}

type Props = {
  slug: string;
  slideId: string;
  config: PollConfig;
};

export function PollInput({ slug, slideId, config }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fp, setFp] = useState<string | null>(null);

  useEffect(() => {
    setFp(getOrCreateFp());
  }, []);

  // Reset quando muda slide.
  useEffect(() => {
    setSelectedIdx(null);
    setError(null);
  }, [slideId]);

  const vote = async (idx: number) => {
    if (!fp) return;
    setError(null);
    setSubmitting(true);
    setSelectedIdx(idx);
    const r = await submitPollVote(slug, slideId, idx, fp);
    setSubmitting(false);
    if (!r.ok) {
      setError(errorMessage(r.error));
      setSelectedIdx(null);
    }
  };

  const showResults =
    selectedIdx != null &&
    (config.showResults === 'instant' || (config.showResults === 'after_reveal' && config.revealed === true));
  const correctIdx = config.correctOption;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-display font-bold text-ink">{config.question}</h2>

      <div className="flex flex-col gap-3">
        {config.options.map((opt, idx) => {
          const isSelected = selectedIdx === idx;
          const isCorrect = showResults && correctIdx != null && idx === correctIdx;
          const isWrong =
            showResults && correctIdx != null && isSelected && idx !== correctIdx;
          // Modo factCheck: botão 1 verde (Fato), botão 2 vermelho (Fake)
          let baseColor = '#3a3a4e';
          if (config.factCheckMode) {
            baseColor = idx === 0 ? '#10b981' : '#ef4444';
          }
          const bg = isCorrect ? '#10b981' : isWrong ? '#ef4444' : isSelected ? '#0a2540' : baseColor;
          const dimmed =
            showResults && correctIdx != null && !isSelected && idx !== correctIdx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => vote(idx)}
              disabled={submitting || selectedIdx != null}
              style={{ background: bg, opacity: dimmed ? 0.5 : 1 }}
              className="w-full py-5 px-6 rounded-xl text-white text-xl font-bold shadow-lg disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>{opt || `Opção ${idx + 1}`}</span>
              {isCorrect ? <span className="ml-2">✓ Certa</span> : null}
              {isWrong ? <span className="ml-2">✗ Errada</span> : null}
            </button>
          );
        })}
      </div>

      {selectedIdx != null && !showResults && config.showResults === 'after_reveal' ? (
        <p className="text-center text-ink/60 text-sm">
          ✓ Seu voto foi registrado. Aguardando o apresentador revelar...
        </p>
      ) : null}

      {selectedIdx != null && showResults && correctIdx == null ? (
        <p className="text-center text-ink/60 text-sm">✓ Seu voto foi registrado.</p>
      ) : null}

      {error ? <p className="text-center text-danger text-sm">{error}</p> : null}
    </div>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case 'submissions_closed':
      return 'Votação encerrada.';
    case 'slide_not_active':
      return 'Este slide não está ativo no momento.';
    case 'invalid_option':
      return 'Opção inválida.';
    case 'invalid_fingerprint':
      return 'Erro de identificação. Recarrega a página.';
    default:
      return 'Erro ao enviar voto. Tenta de novo.';
  }
}
