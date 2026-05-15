'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import {
  resetWordcloud,
  setWordcloudActive,
  updateWordcloudConfig,
} from '@/server-actions/wordcloud';

type Props = {
  eventId: string;
  initialActive: boolean;
  initialConfig: WordcloudConfig;
};

const SAVE_DEBOUNCE_MS = 600;

export function WordcloudTab({ eventId, initialActive, initialConfig }: Props) {
  const [active, setActive] = useState(initialActive);
  const [config, setConfig] = useState<WordcloudConfig>(initialConfig);
  const [toggling, startToggle] = useTransition();
  const [resetting, startReset] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Autosave config with debounce.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void updateWordcloudConfig(eventId, config);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [eventId, config]);

  const toggle = () => {
    startToggle(async () => {
      const next = !active;
      setActive(next);
      const r = await setWordcloudActive(eventId, next);
      if (!r.ok) setActive(!next);
    });
  };

  const onReset = () => {
    if (!window.confirm('Limpar todas as palavras enviadas? Não dá pra desfazer.')) return;
    startReset(async () => {
      await resetWordcloud(eventId);
    });
  };

  const setMax = (n: 1 | 2 | 3) => setConfig((c) => ({ ...c, maxWordsPerSubmission: n }));

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg text-ink">Nuvem de palavras</h3>
            <p className="text-sm text-ink/60">
              Quando ativa, a audiência envia 1 palavra em vez de comentários. O telão troca pra
              exibição da nuvem em tempo real.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Ativar nuvem"
            onClick={toggle}
            disabled={toggling}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              active ? 'bg-accent' : 'bg-ink/20'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-paper transition-transform ${
                active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {active ? (
          <div className="mt-3 rounded-md bg-accent/10 border border-accent/30 px-3 py-2 text-sm text-accent">
            ✨ Nuvem ativa — comentários e disparos H2R ficam em pausa.
          </div>
        ) : null}
      </Card>

      {/* Config */}
      <Card>
        <h3 className="font-display text-lg text-ink mb-3">Pergunta e filtros</h3>
        <div className="space-y-4">
          <Input
            label="Pergunta exibida no telão e no celular"
            id="wc-question"
            value={config.question}
            onChange={(e) => setConfig((c) => ({ ...c, question: e.target.value }))}
            maxLength={120}
            placeholder="Em uma palavra, o que você espera deste evento?"
          />

          <div>
            <p className="text-sm font-medium text-ink mb-2">Palavras por envio</p>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMax(n as 1 | 2 | 3)}
                  className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
                    config.maxWordsPerSubmission === n
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-ink/20 text-ink/70 hover:bg-ink/5'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink/50 mt-1">
              Quantas palavras a galera pode mandar de uma vez (1 = só uma).
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.filterStopwords}
              onChange={(e) => setConfig((c) => ({ ...c, filterStopwords: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">
              Filtrar palavras comuns (de, que, para, ...) silenciosamente
            </span>
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.filterProfanity}
              onChange={(e) => setConfig((c) => ({ ...c, filterProfanity: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">Bloquear palavrões (recomendado)</span>
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={config.showTotal}
              onChange={(e) => setConfig((c) => ({ ...c, showTotal: e.target.checked }))}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-ink">Mostrar contador de palavras enviadas no telão</span>
          </label>
        </div>
      </Card>

      {/* Danger zone */}
      <Card>
        <h3 className="font-display text-lg text-ink mb-2">Zerar nuvem</h3>
        <p className="text-sm text-ink/60 mb-3">
          Apaga todas as palavras enviadas até agora. Útil entre apresentações.
        </p>
        <Button variant="ghost" onClick={onReset} loading={resetting}>
          Limpar nuvem
        </Button>
      </Card>
    </div>
  );
}
