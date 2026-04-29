import { z } from 'zod';

export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const submissionSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome obrigatório')
    .max(60, 'Máximo 60 caracteres')
    .transform(sanitizeText)
    .refine((v) => v.length >= 1, 'Nome obrigatório após limpeza'),
  comment: z
    .string()
    .min(1, 'Comentário obrigatório')
    .max(280, 'Máximo 280 caracteres')
    .transform(sanitizeText)
    .refine((v) => v.length >= 1, 'Comentário obrigatório após limpeza'),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
