import type { ThemeTokens } from '@audience/shared-types';
import { cache } from 'react';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

export const loadTheme = cache(async (themeId: string): Promise<ThemeTokens | null> => {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.from('themes').select('tokens').eq('id', themeId).single();
  return (data?.tokens as ThemeTokens) ?? null;
});
