// @ts-nocheck
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1)
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // ── AI Assistant providers ─────────────────────────────────────────────
  // Primary provider — your own AI. Options: openai | custom | anthropic
  // If not set defaults to anthropic fallback only.
  ASSISTANT_PRIMARY_PROVIDER:  z.enum(['openai', 'custom', 'anthropic']).optional(),

  // OpenAI — used when ASSISTANT_PRIMARY_PROVIDER=openai
  OPENAI_API_KEY:     z.string().min(1).optional(),
  OPENAI_MODEL:       z.string().optional(), // default: gpt-4o-mini

  // Custom endpoint — used when ASSISTANT_PRIMARY_PROVIDER=custom
  // POST to this URL with { messages, system, stream:true }
  // Must return OpenAI-compatible SSE stream
  ASSISTANT_CUSTOM_URL:     z.string().url().optional(),
  ASSISTANT_CUSTOM_API_KEY: z.string().optional(), // sent as Bearer token

  // Anthropic Claude — fallback (or primary if ASSISTANT_PRIMARY_PROVIDER=anthropic)
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL:   z.string().optional(), // default: claude-sonnet-4-6
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY        ||
      process.env.SUPABASE_PUBLISHABLE_KEY             ||
      process.env.SUPABASE_ANON_KEY
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY:    process.env.SUPABASE_SERVICE_ROLE_KEY,
    ASSISTANT_PRIMARY_PROVIDER:   process.env.ASSISTANT_PRIMARY_PROVIDER as any,
    OPENAI_API_KEY:               process.env.OPENAI_API_KEY,
    OPENAI_MODEL:                 process.env.OPENAI_MODEL,
    ASSISTANT_CUSTOM_URL:         process.env.ASSISTANT_CUSTOM_URL,
    ASSISTANT_CUSTOM_API_KEY:     process.env.ASSISTANT_CUSTOM_API_KEY,
    ANTHROPIC_API_KEY:            process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL:              process.env.ANTHROPIC_MODEL,
  });
}

/** Returns true if at least one AI provider is configured */
export function hasAnyAssistantProvider(): boolean {
  const env = getServerEnv();
  if (env.ASSISTANT_PRIMARY_PROVIDER === 'openai'  && env.OPENAI_API_KEY)  return true;
  if (env.ASSISTANT_PRIMARY_PROVIDER === 'custom'  && env.ASSISTANT_CUSTOM_URL) return true;
  if (env.ANTHROPIC_API_KEY) return true;
  return false;
}
