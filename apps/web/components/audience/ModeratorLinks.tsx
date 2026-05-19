'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { generateModeratorToken, revokeModeratorToken } from '@/server-actions/moderatorTokens';

type ExistingToken = {
  id: string;
  token: string;
  display_name: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type Props = {
  eventId: string;
  baseUrl: string; // ex: https://audience-opal.vercel.app
  existing: ExistingToken[];
};

export function ModeratorLinks({ eventId, baseUrl, existing }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [pending, start] = useTransition();
  const [justGenerated, setJustGenerated] = useState<{ url: string; expires: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setError(null);
    start(async () => {
      const res = await generateModeratorToken({
        eventId,
        displayName: displayName.trim() || undefined,
        ttlHours,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setJustGenerated({
        url: `${baseUrl}/m/${res.data.token}`,
        expires: res.data.expiresAt,
      });
      setDisplayName('');
    });
  };

  const revoke = (id: string) => {
    if (!window.confirm('Revogar este link? O moderador perde acesso imediatamente.')) return;
    start(async () => {
      await revokeModeratorToken(id);
    });
  };

  const copyToClipboard = (url: string) => {
    void navigator.clipboard.writeText(url);
  };

  const activeTokens = existing.filter((t) => !t.revoked_at && new Date(t.expires_at) > new Date());
  const inactiveTokens = existing.filter(
    (t) => t.revoked_at || new Date(t.expires_at) <= new Date(),
  );

  const hasActive = activeTokens.length > 0;

  return (
    <Card>
      <details open={hasActive}>
        <summary className="flex items-center justify-between cursor-pointer list-none gap-3 marker:hidden [&::-webkit-details-marker]:hidden">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg mb-0.5 flex items-center gap-2">
              <span>🔗 Link de moderador externo (sem login)</span>
              {hasActive ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                  {activeTokens.length} ativo{activeTokens.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </h3>
            <p className="text-sm text-ink/60">
              Compartilhe um link tokenizado com voluntários — eles moderam sem precisar de
              cadastro.
            </p>
          </div>
          <span className="text-ink/45 text-lg shrink-0">▾</span>
        </summary>

        <div className="grid sm:grid-cols-3 gap-3 mb-3 mt-4">
        <div className="sm:col-span-2">
          <label className="text-xs uppercase tracking-wide text-ink/60 mb-1 block">
            Nome do moderador (opcional)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ex: Pedro voluntário"
            maxLength={60}
            className="h-10 w-full px-3 rounded-md border border-ink/15 bg-transparent text-ink focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-ink/60 mb-1 block">
            Validade (horas)
          </label>
          <input
            type="number"
            value={ttlHours}
            onChange={(e) => setTtlHours(Math.max(1, Math.min(720, Number(e.target.value) || 24)))}
            min={1}
            max={720}
            className="h-10 w-full px-3 rounded-md border border-ink/15 bg-transparent text-ink focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <Button onClick={generate} loading={pending}>
        Gerar link
      </Button>
      {error ? <p className="text-sm text-danger mt-2">{error}</p> : null}

      {justGenerated ? (
        <div className="mt-4 p-3 rounded-md bg-success/10 border border-success/30">
          <p className="text-xs text-success font-medium mb-1">✓ Link gerado</p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-xs bg-paper p-2 rounded break-all">
              {justGenerated.url}
            </code>
            <Button size="sm" onClick={() => copyToClipboard(justGenerated.url)}>
              Copiar
            </Button>
          </div>
          <p className="text-xs text-ink/55 mt-2" suppressHydrationWarning>
            Expira em {new Date(justGenerated.expires).toLocaleString('pt-BR')}
          </p>
        </div>
      ) : null}

      {activeTokens.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Links ativos</p>
          <ul className="divide-y divide-ink/10">
            {activeTokens.map((t) => (
              <li key={t.id} className="py-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-ink truncate">{t.display_name || '(sem nome)'}</p>
                  <p className="text-xs text-ink/55" suppressHydrationWarning>
                    Expira {new Date(t.expires_at).toLocaleString('pt-BR')}
                    {t.last_used_at
                      ? ` · Usado ${new Date(t.last_used_at).toLocaleString('pt-BR')}`
                      : ' · Nunca usado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${baseUrl}/m/${t.token}`)}
                  className="text-xs text-primary hover:underline"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => revoke(t.id)}
                  className="text-xs text-danger hover:underline"
                >
                  Revogar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {inactiveTokens.length > 0 ? (
        <details className="mt-5">
          <summary className="text-xs uppercase tracking-wide text-ink/60 cursor-pointer">
            Links revogados / expirados ({inactiveTokens.length})
          </summary>
          <ul className="divide-y divide-ink/10 mt-2 text-xs text-ink/55">
            {inactiveTokens.map((t) => (
              <li key={t.id} className="py-2" suppressHydrationWarning>
                {t.display_name || '(sem nome)'} —{' '}
                {t.revoked_at
                  ? `revogado ${new Date(t.revoked_at).toLocaleString('pt-BR')}`
                  : `expirado ${new Date(t.expires_at).toLocaleString('pt-BR')}`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      </details>
    </Card>
  );
}
