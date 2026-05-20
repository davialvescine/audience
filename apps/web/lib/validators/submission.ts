import { z } from 'zod';

export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const submissionSchema = z.object({
  // Nome é opcional. Se vazio (ou só whitespace após limpeza), vira 'Anônimo'.
  name: z
    .string()
    .max(60, 'Máximo 60 caracteres')
    .transform(sanitizeText)
    .transform((v) => (v.length === 0 ? 'Anônimo' : v)),
  comment: z
    .string()
    .min(1, 'Comentário obrigatório')
    .max(280, 'Máximo 280 caracteres')
    .transform(sanitizeText)
    .refine((v) => v.length >= 1, 'Comentário obrigatório após limpeza'),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
