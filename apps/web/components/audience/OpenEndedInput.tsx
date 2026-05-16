'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import {
  useOpenEndedResponses,
  type OpenEndedResponse,
} from '@/hooks/useOpenEndedResponses';
import type { OpenEndedConfig } from '@/lib/slides/types';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import { submitOpenEnded, toggleOpenEndedVote } from '@/server-actions/openEnded';

type Props = {
  slug: string;
  eventId: string;
  slideId: string;
  config: OpenEndedConfig;
  initialResponses: OpenEndedResponse[];
};

const FP_KEY = 'audience_fp_v1';
const NAME_KEY = 'audience_name_v1';
const VOTES_KEY = 'audience_votes_v1';

type ChannelLike = Parameters<typeof useOpenEndedResponses>[1]['channel'];

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

function loadVotes(): Record<string, true> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(VOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveVotes(votes: Record<string, true>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

export function OpenEndedInput({
  slug,
  eventId,
  slideId,
  config,
  initialResponses,
}: Props) {
  const [text, setText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mySubmittedCount, setMySubmittedCount] = useState(0);
  const [fp, setFp] = useState('');
  const [myVotes, setMyVotes] = useState<Record<string, true>>({});
  const [channel, setChannel] = useState<ChannelLike | undefined>(undefined);

  useEffect(() => {
    setFp(getOrCreateFp());
    setAuthorName(window.localStorage.getItem(NAME_KEY) || '');
    setMyVotes(loadVotes());
  }, []);

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ch = rt.channel(
      `audience:${eventId}:oer:${Date.now()}`,
    ) as unknown as ChannelLike;
    setChannel(ch);
    return () => {
      ch?.unsubscribe();
    };
  }, [eventId]);

  // Reset state quando o slide muda (operador troca de pergunta).
  useEffect(() => {
    setText('');
    setError(null);
    setMySubmittedCount(0);
  }, [slideId]);

  const { responses } = useOpenEndedResponses(eventId, {
    channel:
      channel ??
      ({
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
        unsubscribe() {},
      } as unknown as ChannelLike),
    initialResponses,
    slideId,
  });

  const limitReached = useMemo(() => {
    if (config.numberOfResponses === 'unlimited') return false;
    return mySubmittedCount >= Number(config.numberOfResponses);
  }, [config.numberOfResponses, mySubmittedCount]);

  const maxLength = config.maxLength || 150;
  const askName = config.askForName === true;
  const allowVoting = config.allowVoting === true;
  const responsesHidden = config.showResponsesMode === 'private';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);
      startTransition(async () => {
        const r = await submitOpenEnded(
          slug,
          trimmed,
          askName && authorName.trim() ? authorName.trim() : null,
          fp,
        );
        if (r.ok) {
          if (askName && authorName.trim()) {
            window.localStorage.setItem(NAME_KEY, authorName.trim());
          }
          setText('');
          setMySubmittedCount((n) => n + 1);
        } else {
          setError(translateError(r.error));
        }
      });
    },
    [text, fp, slug, authorName, askName],
  );

  const handleVote = useCallback(
    async (responseId: string) => {
      const next = { ...myVotes };
      if (next[responseId]) delete next[responseId];
      else next[responseId] = true;
      setMyVotes(next);
      saveVotes(next);
      await toggleOpenEndedVote(responseId, fp);
    },
    [fp, myVotes],
  );

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-wider text-ink/55 font-semibold">
          Sua resposta
        </p>
        <h2 className="text-xl font-semibold mt-1">{config.question}</h2>
      </header>

      {limitReached ? (
        <p className="text-sm text-ink/60 bg-ink/[0.04] rounded-lg px-3 py-2">
          Você já enviou o máximo de respostas pra essa pergunta. Obrigado!
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxLength))}
            placeholder="Compartilhe sua resposta…"
            rows={3}
            // text-base (16px) impede iOS Safari de zoomar ao focar.
            className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            disabled={pending}
            autoFocus
          />
          <div className="flex items-center justify-between text-xs text-ink/55">
            <span>
              {text.length}/{maxLength}
            </span>
            {config.numberOfResponses !== 'unlimited' ? (
              <span>
                {mySubmittedCount}/{config.numberOfResponses} envios
              </span>
            ) : null}
          </div>
          {askName ? (
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Seu nome (opcional)"
              maxLength={60}
              autoComplete="name"
              className="w-full h-11 rounded-lg border border-ink/15 px-3 text-base focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={pending}
            />
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            type="submit"
            variant="accent"
            loading={pending}
            disabled={!text.trim() || pending}
            className="w-full"
          >
            Enviar resposta
          </Button>
        </form>
      )}

      {!responsesHidden && responses.length > 0 ? (
        <section className="pt-4 border-t border-ink/10">
          <p className="text-xs uppercase tracking-wider text-ink/55 font-semibold mb-2">
            Respostas {allowVoting ? '— curta as melhores' : 'recebidas'}
          </p>
          {/* Sem max-h aqui — deixar a página rolar naturalmente no mobile.
              Lista bounded vira scroll-dentro-de-scroll, péssimo no touch. */}
          <ul className="space-y-2">
            {responses.map((r) => (
              <li
                key={r.id}
                className="rounded-lg bg-ink/[0.04] px-3 py-2.5 flex items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-ink/85 break-words leading-snug">{r.text}</p>
                  {r.authorName ? (
                    <p className="text-xs text-ink/45 mt-1">— {r.authorName}</p>
                  ) : null}
                </div>
                {allowVoting ? (
                  <button
                    type="button"
                    onClick={() => handleVote(r.id)}
                    // h-9 min-w-[44px] = tap target ≥44px (iOS HIG).
                    className={`shrink-0 h-9 min-w-[44px] inline-flex items-center justify-center gap-1 px-2 rounded-md text-sm font-semibold transition ${
                      myVotes[r.id]
                        ? 'bg-danger/10 text-danger'
                        : 'text-ink/55 hover:bg-ink/[0.08] active:bg-ink/[0.12]'
                    }`}
                    aria-label="Curtir resposta"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M12 21s-7.5-4.5-9.5-9.2C1.1 8.4 3 5 6.2 5c1.7 0 3.3.9 4.3 2.3C11.5 5.9 13.1 5 14.8 5 18 5 19.9 8.4 18.5 11.8 16.5 16.5 12 21 12 21z" />
                    </svg>
                    <span className="tabular-nums">{r.voteCount}</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function translateError(err: string): string {
  switch (err) {
    case 'limit_reached':
      return 'Você atingiu o limite de respostas pra essa pergunta.';
    case 'text_invalid_length':
      return 'A resposta precisa ter entre 1 e 500 caracteres.';
    case 'no_active_slide':
    case 'wrong_slide_type':
      return 'Esta pergunta não está mais ativa.';
    case 'event_not_found':
      return 'Evento não encontrado.';
    default:
      return 'Não foi possível enviar. Tente de novo.';
  }
}
