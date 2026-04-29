'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    if (typeof window !== 'undefined' && (window as { Sentry?: { captureException: (e: Error, c?: unknown) => void } }).Sentry) {
      (window as unknown as { Sentry: { captureException: (e: Error, c?: unknown) => void } }).Sentry.captureException(error, {
        contexts: { react: info },
      });
    }
  }

  override render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div role="alert" className="p-6 bg-surface rounded-lg">
            <h2 className="text-lg font-semibold text-danger">Algo deu errado.</h2>
            <p className="mt-2 text-sm text-ink/70">Tente recarregar a página.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
