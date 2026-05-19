'use client';

import { motion } from 'framer-motion';

import { shadowStyle, type TelaoConfig } from '@/lib/telao/config';

type Submission = {
  id: string;
  name: string;
  comment: string;
  created_at: string;
  submissionId?: string;
};

type Props = {
  m: Submission;
  config: TelaoConfig;
  eventName: string;
  effectiveHeight: number;
  /** Se o pai é grid stack (maxConcurrent=1), passa true. */
  stackedSingle: boolean;
};

/**
 * Card individual do slide Cards rotativos. Component próprio pra isolar:
 * - Animação de entrada/saída (fade puro, sem layout shift)
 * - Auto-shrink do texto por tamanho do comentário
 * - Estilos derivados do config (cor, sombra, blur, fonte)
 *
 * Posicionamento e altura ficam com o pai (TelaoClient). Aqui só
 * desenha o card já com altura fixa via effectiveHeight.
 */
export function CommentCard({ m, config, eventName, effectiveHeight, stackedSingle }: Props) {
  const cardBg =
    (config as { showCardBackground?: boolean }).showCardBackground === false
      ? 'transparent'
      : config.cardBg;
  const showBlur =
    (config as { showCardBackground?: boolean }).showCardBackground !== false &&
    config.backdropBlur > 0;

  // Auto-shrink do texto. Quanto maior o comentário, menor a fonte.
  // Mantém leiturabilidade e evita estourar o card de altura fixa.
  const len = m.comment.length;
  const commentFontScale = len <= 80 ? 1 : len <= 160 ? 0.82 : len <= 280 ? 0.66 : 0.52;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      style={{
        background: cardBg,
        color: config.cardText,
        borderRadius: `${config.borderRadius}px`,
        boxShadow: cardBg === 'transparent' ? 'none' : shadowStyle(config.shadow),
        backdropFilter: showBlur ? `blur(${config.backdropBlur}px)` : undefined,
        WebkitBackdropFilter: showBlur ? `blur(${config.backdropBlur}px)` : undefined,
        padding: `${Math.round(config.fontSizePx * 0.6)}px ${Math.round(config.fontSizePx * 0.85)}px`,
        fontSize: `${config.fontSizePx}px`,
        lineHeight: 1.3,
        height: `${effectiveHeight}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        // Grid stacking: todos os cards no mesmo gridArea (1/1) sobrepostos.
        ...(stackedSingle ? { gridArea: '1 / 1' } : {}),
      }}
    >
      {/* Header — nome + horário + evento. Tamanho proporcional ao card. */}
      {(config.showAvatar !== false || config.showTimestamp || config.showEventName) && (
        <div
          style={{
            fontSize: `${Math.round(config.fontSizePx * 0.55)}px`,
            opacity: 0.75,
            fontWeight: 600,
            letterSpacing: '0.02em',
            marginBottom: '0.25em',
          }}
        >
          {config.showEventName && eventName ? (
            <span style={{ marginRight: 8 }}>{eventName} ·</span>
          ) : null}
          {config.showAvatar !== false ? m.name : null}
          {config.showTimestamp ? (
            <span style={{ marginLeft: 8, opacity: 0.6 }} suppressHydrationWarning>
              {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}
        </div>
      )}

      <div
        style={{
          fontWeight: 500,
          wordBreak: 'break-word',
          fontSize: `${Math.round(config.fontSizePx * commentFontScale)}px`,
        }}
      >
        {m.comment}
      </div>
    </motion.div>
  );
}
