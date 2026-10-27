import { z } from 'zod'

/** The variables in .env.example and no others. Empty strings count as unset. */
const EnvSchema = z.object({
  MODEL_PROVIDER: z.enum(['gemini', 'anthropic', 'opencode', 'stub']).default('stub'),
  MODEL_NAME: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENCODE_API_KEY: z.string().optional(),
  ZEN_MODEL: z.string().optional(),
  OPENCODE_BASE_URL: z.url().optional(),
  SUMMARY_PROVIDER: z.enum(['gemini', 'opencode']).optional(),
  SPEECH_PROVIDER: z.enum(['none', 'operator']).default('none'),
  SHEETS_WEBHOOK_URL: z.url().optional(),
  OPERATOR_AUTO: z
    .string()
    .optional()
    .transform((v) => /^(1|true|yes|on)$/i.test(v ?? '')),
  STUB_THINK_MS: z.coerce.number().int().nonnegative().default(2400),
  DATABASE_PATH: z.string().default('data/session.sqlite'),
  PORT: z.coerce.number().int().positive().default(8787),
})

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const present = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''))
  const parsed = EnvSchema.safeParse(present)
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`.env cannot be used:\n${lines.join('\n')}`)
  }
  return parsed.data
}
