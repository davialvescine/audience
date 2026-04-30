'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { slugify } from '@/lib/utils/slugify';
import { createEvent } from '@/server-actions/createEvent';

type Theme = { id: string; slug: string; name: string };
type Props = { themes: Theme[] };

export function NewEventForm({ themes }: Props) {
  const [name, setName] = useState('');
  const slug = slugify(name);
  const slugPreview = slug || '...';

  return (
    <form action={createEvent} className="space-y-5">
      <Input
        label="Nome do evento"
        id="name"
        name="name"
        required
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: O Nascer de Uma Geração"
      />

      <div className="bg-surface rounded-md p-3 border border-ink/10 dark:border-ink/15">
        <p className="text-xs text-ink/70 mb-1">URL pública</p>
        <p className="font-mono text-sm text-primary break-all">
          audience.app/e/<span className="text-ink font-bold">{slugPreview}</span>
        </p>
      </div>

      <label htmlFor="themeId" className="block">
        <span className="text-sm font-medium text-ink">Tema visual</span>
        <select
          id="themeId"
          name="themeId"
          required
          className="mt-1 block w-full h-11 px-3 rounded-md border border-ink/25 dark:border-ink/30 bg-paper text-ink"
          defaultValue={themes[0]?.id}
        >
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <Button type="submit" className="w-full" size="lg">
        Criar evento
      </Button>
    </form>
  );
}
