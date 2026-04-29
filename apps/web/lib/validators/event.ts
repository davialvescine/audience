import { z } from 'zod';

export const eventSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'apenas letras minúsculas, números e hífens'),
  themeId: z.string().uuid(),
});
