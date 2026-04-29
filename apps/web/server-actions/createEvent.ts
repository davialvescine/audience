'use server';

import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { eventSchema } from '@/lib/validators/event';

export async function createEvent(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = eventSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    themeId: formData.get('themeId'),
  });
  if (!parsed.success) {
    redirect('/admin/events/new?error=invalid');
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      theme_id: parsed.data.themeId,
      owner_id: user.id,
    })
    .select('slug')
    .single();

  if (error) {
    if (error.code === '23505') redirect('/admin/events/new?error=slug-taken');
    redirect('/admin/events/new?error=unknown');
  }
  redirect(`/admin/events/${data.slug}/settings`);
}
