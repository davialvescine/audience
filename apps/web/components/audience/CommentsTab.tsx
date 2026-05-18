'use client';

import type { ReactNode } from 'react';

type Props = {
  moderation: ReactNode;
  pendingCount: number;
};

/**
 * Aba "Comentários" — só moderação agora. Antes tinha sub-tabs Moderação /
 * Telão / Compartilhar, mas o telão e compartilhar viraram parte do sistema
 * de slides (cada slide tem sua config + botão "Copiar URL pro OBS" no painel).
 * Manter Comentários como TAB DEDICADA SÓ pra moderar a fila — workflow
 * principal do operador durante o evento.
 */
export function CommentsTab({ moderation, pendingCount: _ }: Props) {
  void _;
  return <div className="space-y-4">{moderation}</div>;
}
