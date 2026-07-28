import { z } from 'zod';

/**
 * Zod schema for all environment variables.
 * Validated at import time — if any required var is missing or malformed,
 * the process crashes immediately with a descriptive error.
 *
 * SECURITY: No provider API key is ever exposed to the client.
 * Only NEXT_PUBLIC_* vars are visible in browser bundles.
 */
const envSchema = z.object({
  // ─── Supabase ──────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // ─── LLM Providers (at least one must be configured) ──────
  GROQ_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.string().url().optional().default('http://localhost:11434'),

  // ─── Rate Limiting (Upstash Redis - Optional) ────────────
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // ─── App Configuration ────────────────────────────────────
  CLASSIFIER_MODE: z
    .enum(['rules', 'llm', 'hybrid'])
    .default('rules'),
  MAX_PROMPT_LENGTH: z.coerce
    .number()
    .int()
    .positive()
    .default(32_000),
  LOG_FULL_PROMPTS: z
    .enum(['true', 'false'])
    .default('false'),

  // ─── Node environment ─────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
}).refine(
  (data) => data.GROQ_API_KEY || data.GEMINI_API_KEY || data.OLLAMA_BASE_URL !== 'http://localhost:11434',
  {
    message:
      'At least one LLM provider must be configured: set GROQ_API_KEY, GEMINI_API_KEY, or a non-default OLLAMA_BASE_URL',
  },
);

export type Env = z.infer<typeof envSchema>;

/**
 * Validated environment variables. This module crashes at import time
 * if validation fails — you should never catch this error.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      `\n❌ Environment validation failed:\n${formatted}\n\nCheck your .env.local file against .env.example\n`,
    );

    // In test mode, return a mock env to avoid crashing test runners
    if (process.env.NODE_ENV === 'test') {
      return {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        GROQ_API_KEY: 'test-groq-key',
        GEMINI_API_KEY: undefined,
        OLLAMA_BASE_URL: 'http://localhost:11434',
        UPSTASH_REDIS_REST_URL: 'http://localhost:6379',
        UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
        CLASSIFIER_MODE: 'rules',
        MAX_PROMPT_LENGTH: 32_000,
        LOG_FULL_PROMPTS: 'false',
        NODE_ENV: 'test',
      } as Env;
    }

    throw new Error('Environment validation failed. See console output above.');
  }

  return result.data;
}

export const env = validateEnv();
