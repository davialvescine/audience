'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils/slugify';

const schema = z.object({
  name: z.string().min(2).max(100),
  themeId: z.string().uuid(),
});

export async function createEvent(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    name: formData.get('name'),
    themeId: formData.get('themeId'),
  });
  if (!parsed.success) redirect('/admin/events/new?error=invalid');

  const baseSlug = slugify(parsed.data.name);
  if (!baseSlug) redirect('/admin/events/new?error=invalid-name');

  const supabase = await getSupabaseServerClient();

  // Find a free slug, appending -2, -3, ... if needed
  let candidate = baseSlug;
  let suffix = 2;
  for (let i = 0; i < 50; i += 1) {
    const { data } = await supabase
      .from('events')
      .select('slug')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) break;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      name: parsed.data.name,
      slug: candidate,
      theme_id: parsed.data.themeId,
      owner_id: user.id,
    })
    .select('slug')
    .single();

  if (error || !data) {
    console.error('[createEvent] failed', {
      userId: user.id,
      slug: candidate,
      error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : 'no-data-no-error',
    });
    redirect('/admin/events/new?error=unknown');
  }
  redirect(`/admin/events/${data.slug}/settings`);
}
