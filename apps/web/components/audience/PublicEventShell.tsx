import { SubmissionForm } from './SubmissionForm';

type Props = { eventName: string; slug: string; submissionsOpen: boolean };

export function PublicEventShell({ eventName, slug, submissionsOpen }: Props) {
  return (
    <div className="min-h-[100svh] bg-gradient-to-br from-primary via-primary-deep to-primary text-paper relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-accent/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-secondary/40 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative max-w-md mx-auto px-5 pt-12 pb-8 min-h-[100svh] flex flex-col">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-paper/10 backdrop-blur text-xs font-medium uppercase tracking-wider mb-4">
            Ao vivo no telão
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold leading-tight">
            {eventName}
          </h1>
          <p className="mt-3 text-base sm:text-lg opacity-80">
            Mande sua mensagem
          </p>
        </div>

        {/* Form card */}
        <div className="flex-1 flex items-start">
          <div className="w-full bg-paper text-ink rounded-2xl shadow-2xl p-5 sm:p-6">
            {submissionsOpen ? (
              <SubmissionForm slug={slug} />
            ) : (
              <div className="text-center py-8">
                <p className="text-2xl font-display text-primary mb-2">⏸️</p>
                <p className="text-ink/60">Submissões encerradas</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs opacity-60">
          🔒 Sua mensagem passa por moderação antes de aparecer
        </div>
      </div>
    </div>
  );
}
