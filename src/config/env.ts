import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  THREADS_USER_ID: z.string().min(1).optional(),
  THREADS_ACCESS_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and returns environment variables. Throws if required vars are missing when strict.
 */
export function loadEnv(strict = true): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  const env = parsed.data;
  if (strict) {
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required');
    if (!env.THREADS_USER_ID) throw new Error('THREADS_USER_ID is required');
    if (!env.THREADS_ACCESS_TOKEN) throw new Error('THREADS_ACCESS_TOKEN is required');
  }
  return env;
}
