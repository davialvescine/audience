import Link from 'next/link';

import { FeatureGrid } from '@/components/audience/FeatureGrid';
import { HomeHero } from '@/components/audience/HomeHero';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="border-b border-ink/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-primary">Audience</span>
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
        </div>
      </header>

      <HomeHero />

      <section className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-ink">
            Simples para a audiência. Seguro para você.
          </h2>
          <p className="mt-4 text-ink/70 leading-relaxed">
            Toda mensagem passa por moderação antes de aparecer no telão. Você decide o que entra.
          </p>
        </div>
        <FeatureGrid />
      </section>

      <section className="bg-gradient-to-r from-primary to-primary-deep text-paper">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold">
            Pronto pro próximo evento?
          </h2>
          <p className="mt-4 text-lg opacity-85 max-w-xl mx-auto">
            Acesse o painel e crie um evento em menos de um minuto.
          </p>
          <div className="mt-8">
            <Link href="/admin">
              <Button variant="accent" size="lg">
                Acessar painel
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink/10 bg-paper">
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
