'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type Props = { publicUrl: string };

export function ShareCard({ publicUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide font-bold text-primary mb-1">
            Link público pra audiência
          </p>
          <p className="font-mono text-sm md:text-base text-ink break-all">{publicUrl}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="accent"
            onClick={() => {
              void navigator.clipboard.writeText(publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? '✓ Copiado!' : 'Copiar link'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowQr((v) => !v)}>
            {showQr ? 'Esconder QR' : 'Mostrar QR'}
          </Button>
        </div>
      </div>
      {showQr ? (
        <div className="mt-6 flex justify-center">
          <div className="bg-paper p-4 rounded-lg">
            <QRCodeSVG value={publicUrl} size={200} level="M" />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
