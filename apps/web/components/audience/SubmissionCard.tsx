'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useTransition } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { approveSubmission, rejectSubmission, retrySubmission } from '@/server-actions/moderation';
import { shadowStyle, type TelaoConfig } from '@/lib/telao/config';

type Props = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  createdAt: string;
  errorMessage: string | null;
  telaoConfig?: TelaoConfig | undefined;
};

// Mini preview do card como ele apareceria no telão. Render fixo numa
// caixa 16:9 — cores/borda/sombra do telaoConfig, font scaled pra
// caber. Util pra operador checar se a mensagem fica boa antes de
// aprovar (comentario muito longo + font grande = sai feio no telão).
function MiniTelaoPreview({
  name,
  comment,
  config,
}: {
  name: string;
  comment: string;
  config: TelaoConfig;
}) {
  // 280px = aproximadamente 14% da largura do palco 1920. Escalar fonte
  // proporcionalmente mantém a relação de tamanho.
  const scale = 280 / 1920;
  return (
    <div className="mt-3 w-full max-w-xs aspect-video rounded-md bg-gradient-to-br from-slate-100 via-white to-slate-200 ring-1 ring-ink/10 overflow-hidden relative">
      <div className="absolute inset-0 flex items-end justify-center p-2">
        <div
          style={{
            background: config.cardBg,
            color: config.cardText,
            fontFamily: config.fontFamily,
            borderRadius: `${Math.max(2, config.borderRadius * scale)}px`,
            boxShadow: shadowStyle(config.shadow),
            padding: `${Math.max(2, Math.round(config.fontSizePx * 0.6 * scale))}px ${Math.max(4, Math.round(config.fontSizePx * 0.85 * scale))}px`,
            fontSize: `${Math.max(8, config.fontSizePx * scale)}px`,
            lineHeight: 1.3,
            maxWidth: '92%',
          }}
        >
          <div
            style={{
              fontSize: `${Math.max(7, config.fontSizePx * 0.55 * scale)}px`,
              opacity: 0.75,
              fontWeight: 600,
              letterSpacing: '0.02em',
              marginBottom: '0.2em',
            }}
          >
            {name}
          </div>
          <div style={{ fontWeight: 500, wordBreak: 'break-word' }}>{comment}</div>
        </div>
      </div>
    </div>
  );
}

export function SubmissionCard({ id, name, comment, status, createdAt, errorMessage, telaoConfig }: Props) {
  const [pending, start] = useTransition();
  const isFinal = status === 'sent' || status === 'rejected';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-ink truncate">{name}</span>
            <Badge status={status} />
          </div>
          <p className="text-ink/80 break-words">{comment}</p>
          <p className="mt-2 text-xs text-ink/55" suppressHydrationWarning>
            {new Date(createdAt).toLocaleTimeString('pt-BR')}
          </p>
          {errorMessage ? <p className="mt-1 text-xs text-danger">Erro: {errorMessage}</p> : null}
          {telaoConfig ? <MiniTelaoPreview name={name} comment={comment} config={telaoConfig} /> : null}
        </div>
      </div>
      {!isFinal ? (
        <div className="mt-4 flex gap-2">
          {status === 'pending' ? (
            <>
              <Button
                variant="accent"
                loading={pending}
                onClick={() => start(() => approveSubmission(id).then(() => undefined))}
              >
                Aprovar
              </Button>
              <Button
                variant="ghost"
                loading={pending}
                onClick={() => start(() => rejectSubmission(id).then(() => undefined))}
              >
                Rejeitar
              </Button>
            </>
          ) : null}
          {status === 'failed' ? (
            <Button
              loading={pending}
              onClick={() => start(() => retrySubmission(id).then(() => undefined))}
            >
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
