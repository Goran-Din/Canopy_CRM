import { z } from 'zod';

// Public signing page — GET (validates token format)
export const signingTokenParamSchema = z.object({
  token: z.string().length(64).regex(/^[a-f0-9]+$/, 'Invalid token format'),
});

// Public signing — POST (signature submission)
export const submitSignatureSchema = z.object({
  signing_token: z.string().length(64).regex(/^[a-f0-9]+$/, 'Invalid token format'),
  signer_name: z.string().min(2).max(255).trim(),
  signature_image_base64: z.string().min(100),
  agreement_checked: z.literal(true, {
    errorMap: () => ({ message: 'Agreement must be accepted' }),
  }),
});

export type SubmitSignatureInput = z.infer<typeof submitSignatureSchema>;

// Staff endpoint params
export const quoteIdParamsSchema = z.object({
  id: z.string().uuid('Invalid quote ID'),
});
