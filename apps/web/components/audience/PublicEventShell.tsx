import { AudienceInputSwitcher } from './AudienceInputSwitcher';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { OpenEndedConfig } from '@/lib/slides/types';

type Props = {
  eventName: string;
  slug: string;
  eventId: string;
  submissionsOpen: boolean;
  activeSlideId: string | null;
  activeSlideType: 'wordcloud' | 'open_ended' | 'comments' | null;
  activeSlideConfig: WordcloudConfig | null;
  openEndedConfig: OpenEndedConfig | null;
  openEndedInitialResponses: OpenEndedResponse[];
  forceMode?: 'auto' | 'comments' | 'slides' | undefined;
};

export function PublicEventShell({
  eventName,
  slug,
  eventId,
  submissionsOpen,
  activeSlideId,
  activeSlideType,
  activeSlideConfig,
  openEndedConfig,
  openEndedInitialResponses,
  forceMode = 'auto',
}: Props) {
  const showingSlide =
    forceMode === 'slides' || (forceMode === 'auto' && activeSlideId != null);
  // Hero text adapta: aberto pede "resposta", comentários "mensagem", nuvem "palavra".
  const heroSubtitle =
    activeSlideType === 'open_ended'
      ? 'Sua resposta no telão'
      : activeSlideType === 'comments'
        ? 'Mande sua mensagem'
        : showingSlide
          ? 'Sua palavra na nuvem'
          : 'Mande sua mensagem';
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

      <div
        className="relative max-w-md mx-auto px-5 pt-12 min-h-[100svh] flex flex-col"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-paper/10 backdrop-blur text-xs font-medium uppercase tracking-wider mb-4">
            Ao vivo no telão
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold leading-tight">{eventName}</h1>
          <p className="mt-3 text-base sm:text-lg opacity-80">{heroSubtitle}</p>
        </div>

        {/* Form card */}
        <div className="flex-1 flex items-start">
          <div className="w-full bg-paper text-ink rounded-2xl shadow-2xl p-5 sm:p-6">
            <AudienceInputSwitcher
              slug={slug}
              eventId={eventId}
              submissionsOpen={submissionsOpen}
              initialActiveSlideId={activeSlideId}
              initialActiveSlideType={activeSlideType}
              initialActiveSlideConfig={activeSlideConfig}
              initialOpenEndedConfig={openEndedConfig}
              initialOpenEndedResponses={openEndedInitialResponses}
              forceMode={forceMode}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs opacity-60">
          {activeSlideType === 'open_ended'
            ? '✨ Sua resposta aparece no telão na hora'
            : activeSlideType === 'comments'
              ? '🔒 Sua mensagem passa por moderação antes de aparecer'
              : showingSlide
                ? '✨ Sua palavra entra na nuvem em tempo real'
                : '🔒 Sua mensagem passa por moderação antes de aparecer'}
        </div>
      </div>
    </div>
  );
}
