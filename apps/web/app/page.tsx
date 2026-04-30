import Link from 'next/link';

import { CtaSection } from '@/components/audience/CtaSection';
import { FeatureGrid } from '@/components/audience/FeatureGrid';
import { HomeHero } from '@/components/audience/HomeHero';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="border-b border-ink/10 dark:border-ink/15">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-primary">Audience</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <HomeHero />

      <section className="relative max-w-6xl mx-auto px-6 py-20 md:py-24 w-full">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 text-ink opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-ink tracking-tight leading-[1.1]">
              Simples para a audiência. Seguro para você.
            </h2>
            <p className="mt-4 text-ink/70 leading-relaxed">
              Toda mensagem passa por moderação antes de aparecer no telão. Você decide o que entra.
            </p>
          </div>
          <FeatureGrid />
        </div>
      </section>

      <CtaSection />

      <footer className="border-t border-ink/10 dark:border-ink/15 bg-paper">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ink/60">
          <div className="font-display text-base text-primary font-bold">Audience</div>
          <div className="text-center md:text-right">
            <p className="font-medium text-ink/80">União Centro-Oeste Brasileira</p>
            <p className="text-xs mt-0.5">© {new Date().getFullYear()} · Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
