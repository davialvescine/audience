'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { signInWithEmail, signInWithPassword } from '@/server-actions/auth';

const errorMessages: Record<string, string> = {
  missing: 'Preencha email e senha.',
  invalid: 'Email ou senha incorretos.',
};

type Mode = 'password' | 'forgot';
type Props = {
  errorParam?: string | undefined;
  sentParam?: string | undefined;
  initialMode: Mode;
};

export function LoginForm({ errorParam, sentParam, initialMode }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const errorMsg = errorParam ? errorMessages[errorParam] : null;
  const sent = sentParam === '1';

  if (mode === 'forgot') {
    return (
      <div className="bg-paper rounded-2xl border border-ink/10 shadow-sm p-7">
        <button
          type="button"
          onClick={() => setMode('password')}
          className="text-sm text-ink/60 hover:text-primary mb-4 inline-flex items-center gap-1"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <h1 className="text-2xl font-display font-semibold text-ink">Recuperar acesso</h1>
        <p className="text-sm text-ink/60 mt-1 mb-6">
          Enviamos um link mágico pra você entrar sem senha.
        </p>
        {sent ? (
          <div role="status" className="p-4 rounded-lg bg-success/10 text-success text-sm">
            ✓ Link enviado! Verifique seu email.
          </div>
        ) : (
          <form
            action={(formData: FormData) => start(async () => signInWithEmail(formData))}
            className="space-y-4"
          >
            <Input
              label="Seu email"
              id="forgot-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="exemplo@email.com"
            />
            <Button type="submit" loading={pending} className="w-full" size="lg">
              Enviar link mágico
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="bg-paper rounded-2xl border border-ink/10 shadow-sm p-7">
      <h1 className="text-2xl font-display font-semibold text-ink">Entrar</h1>
      <p className="text-sm text-ink/60 mt-1 mb-6">Acesse o painel administrativo.</p>

      {errorMsg ? (
        <div role="alert" className="mb-5 p-3 rounded-lg bg-danger/10 text-danger text-sm">
          {errorMsg}
        </div>
      ) : null}

      <form
        action={(formData: FormData) => start(async () => signInWithPassword(formData))}
        className="space-y-4"
      >
        <Input
          label="Email"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="exemplo@email.com"
        />

        <div>
          <div className="relative">
            <Input
              label="Senha"
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
              className="absolute right-3 top-[calc(50%+8px)] -translate-y-1/2 text-ink/40 hover:text-ink/70"
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="text-xs text-primary hover:underline"
            >
              Esqueceu a senha?
            </button>
          </div>
        </div>

        <Button type="submit" loading={pending} className="w-full" size="lg">
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-xs text-ink/40 text-center">
        Acesso por convite apenas.
      </p>
    </div>
  );
}
