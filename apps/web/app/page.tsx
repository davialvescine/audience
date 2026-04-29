import Link from 'next/link';

import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Top nav */}
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

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-deep text-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-secondary/30 blur-3xl"
        />

        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-paper/10 backdrop-blur text-xs font-medium uppercase tracking-wider mb-6">
              Para eventos ao vivo
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold leading-[1.05] tracking-tight">
              Comentários da audiência<br />direto no telão.
            </h1>
            <p className="mt-6 text-lg md:text-xl opacity-85 max-w-2xl leading-relaxed">
              Conecte sua transmissão ao vivo com sua audiência. Eles enviam mensagens pelo
              celular, você modera com um clique e o comentário aparece no telão em segundos.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link href="/admin">
                <Button variant="accent" size="lg">
                  Acessar painel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-ink">
            Simples para a audiência. Seguro para você.
          </h2>
          <p className="mt-4 text-ink/70 leading-relaxed">
            Toda mensagem passa por moderação antes de aparecer no telão. Você decide o que entra.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-surface rounded-xl p-7 border border-ink/5">
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-5">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink">Audiência envia</h3>
            <p className="mt-2 text-sm text-ink/70 leading-relaxed">
              Participantes acessam um link único do evento pelo celular e enviam nome + mensagem.
              Sem cadastro, sem senha.
            </p>
          </div>

          <div className="bg-surface rounded-xl p-7 border border-ink/5">
            <div className="h-11 w-11 rounded-lg bg-accent/15 text-primary-deep flex items-center justify-center mb-5">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink">Você modera</h3>
            <p className="mt-2 text-sm text-ink/70 leading-relaxed">
              Painel em tempo real mostra cada submissão assim que chega. Aprove, rejeite ou
              tente novamente — sem refresh, sem espera.
            </p>
          </div>

          <div className="bg-surface rounded-xl p-7 border border-ink/5">
            <div className="h-11 w-11 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center mb-5">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink">Vai pro telão</h3>
            <p className="mt-2 text-sm text-ink/70 leading-relaxed">
              Aprovou? Em segundos a mensagem aparece automaticamente no software de
              transmissão integrado ao seu evento.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
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

      {/* Footer */}
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
