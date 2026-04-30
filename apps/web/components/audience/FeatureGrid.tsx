'use client';

import { motion } from 'framer-motion';

const features = [
  {
    title: 'Audiência envia',
    description:
      'Participantes acessam um link único do evento pelo celular e enviam nome + mensagem. Sem cadastro, sem senha.',
    iconBg: 'bg-primary/10 text-primary',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    ),
  },
  {
    title: 'Você modera',
    description:
      'Painel em tempo real mostra cada submissão assim que chega. Aprove, rejeite ou tente novamente — sem refresh, sem espera.',
    iconBg: 'bg-accent/15 text-primary-deep',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    ),
  },
  {
    title: 'Vai pro telão',
    description:
      'Aprovou? Em segundos a mensagem aparece automaticamente no software de transmissão integrado ao seu evento.',
    iconBg: 'bg-secondary/15 text-secondary',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    ),
  },
];

export function FeatureGrid() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-surface rounded-xl p-7 border border-ink/10 dark:border-ink/15"
        >
          <div className={`h-11 w-11 rounded-lg flex items-center justify-center mb-5 ${f.iconBg}`}>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {f.icon}
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-ink">{f.title}</h3>
          <p className="mt-2 text-sm text-ink/70 leading-relaxed">{f.description}</p>
        </motion.div>
      ))}
    </div>
  );
}
