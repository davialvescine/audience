'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';

export function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-[rgb(14_76_94)] dark:bg-[rgb(7_32_44)] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgb(14_76_94)] via-[rgb(10_44_61)] to-[rgb(7_32_44)] dark:from-[rgb(11_18_28)] dark:via-[rgb(7_32_44)] dark:to-[rgb(0_0_0)]"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-secondary/30 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-36">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs font-medium uppercase tracking-[0.18em] mb-6 text-white"
          >
            Para eventos ao vivo
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="text-4xl md:text-7xl font-display font-bold leading-[1.02] tracking-tight"
          >
            Comentários da audiência
            <br />
            <span className="text-accent/95">direto no telão.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="mt-6 text-lg md:text-xl opacity-85 max-w-2xl leading-relaxed"
          >
            Conecte sua transmissão ao vivo com sua audiência. Eles enviam mensagens pelo celular,
            você modera com um clique e o comentário aparece no telão em segundos.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
            className="mt-10 flex flex-col sm:flex-row gap-3"
          >
            <Link href="/admin">
              <Button variant="accent" size="lg">
                Acessar painel
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
