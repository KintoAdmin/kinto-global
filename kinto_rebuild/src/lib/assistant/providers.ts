// @ts-nocheck
/**
 * Kinto AI — Provider Layer
 *
 * Priority order:
 *   1. Your primary provider (OpenAI | custom endpoint)  — Kinto AI brand
 *   2. Anthropic Claude                                   — fallback only
 *
 * The caller gets a ReadableStream regardless of which provider answered.
 * Provider selection and fallback is invisible to the UI — it always sees "Kinto AI".
 */

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export interface ProviderConfig {
  primaryProvider:  string | undefined;
  openaiKey:        string | undefined;
  openaiModel:      string | undefined;
  customUrl:        string | undefined;
  customApiKey:     string | undefined;
  anthropicKey:     string | undefined;
  anthropicModel:   string | undefined;
}

// ── OpenAI SSE → plain text stream ────────────────────────────────────────
// data: {"choices":[{"delta":{"content":"..."}}]}
function openAIStream(res: Response): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(ctrl) {
      const reader = res.body?.getReader();
      if (!reader) { ctrl.close(); return; }
      const dec = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              const text = evt?.choices?.[0]?.delta?.content;
              if (typeof text === 'string') ctrl.enqueue(enc.encode(text));
            } catch { /* skip malformed */ }
          }
        }
      } finally { reader.releaseLock(); ctrl.close(); }
    },
  });
}

// ── Anthropic SSE → plain text stream ─────────────────────────────────────
// {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
function anthropicStream(res: Response): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(ctrl) {
      const reader = res.body?.getReader();
      if (!reader) { ctrl.close(); return; }
      const dec = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              if (evt?.type === 'content_block_delta' && evt?.delta?.type === 'text_delta') {
                ctrl.enqueue(enc.encode(evt.delta.text));
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally { reader.releaseLock(); ctrl.close(); }
    },
  });
}

// ── OpenAI call ────────────────────────────────────────────────────────────
async function callOpenAI(
  messages: ChatMsg[], system: string, apiKey: string, model: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 1024, stream: true,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => '')}`);
  return openAIStream(res);
}

// ── Custom endpoint call ───────────────────────────────────────────────────
// Must accept POST { messages, system, stream: true } and return OpenAI-compatible SSE
async function callCustom(
  messages: ChatMsg[], system: string, url: string, apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({
      messages: [{ role: 'system', content: system }, ...messages],
      system, stream: true, max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Custom endpoint ${res.status}: ${await res.text().catch(() => '')}`);
  return openAIStream(res);
}

// ── Anthropic call ─────────────────────────────────────────────────────────
async function callAnthropic(
  messages: ChatMsg[], system: string, apiKey: string, model: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1024, system, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => '')}`);
  return anthropicStream(res);
}

// ── Public API ─────────────────────────────────────────────────────────────
export type ProviderResult = {
  stream: ReadableStream<Uint8Array>;
  providerUsed: 'openai' | 'custom' | 'anthropic';
};

/**
 * Call AI with automatic fallback:
 *   Primary (your AI) → Anthropic fallback
 * Returns the stream + which provider actually answered.
 */
export async function callAssistant(
  messages: ChatMsg[],
  system: string,
  config: ProviderConfig
): Promise<ProviderResult> {
  const primary = config.primaryProvider;
  const errors: string[] = [];

  // ── Primary: OpenAI ────────────────────────────────────────────────────
  if (primary === 'openai' && config.openaiKey) {
    try {
      const model = config.openaiModel || 'gpt-4o-mini';
      return { stream: await callOpenAI(messages, system, config.openaiKey, model), providerUsed: 'openai' };
    } catch (e: any) {
      errors.push(`OpenAI: ${e?.message || e}`);
      // fall through to next provider
    }
  }

  // ── Primary: Custom endpoint ───────────────────────────────────────────
  if (primary === 'custom' && config.customUrl) {
    try {
      return { stream: await callCustom(messages, system, config.customUrl, config.customApiKey), providerUsed: 'custom' };
    } catch (e: any) {
      errors.push(`Custom: ${e?.message || e}`);
    }
  }

  // ── Primary set to anthropic explicitly ───────────────────────────────
  if (primary === 'anthropic' && config.anthropicKey) {
    const model = config.anthropicModel || 'claude-sonnet-4-6';
    return { stream: await callAnthropic(messages, system, config.anthropicKey, model), providerUsed: 'anthropic' };
  }

  // ── Fallback: Anthropic ────────────────────────────────────────────────
  // Only reached if primary failed or was not configured
  if (config.anthropicKey) {
    try {
      const model = config.anthropicModel || 'claude-sonnet-4-6';
      return { stream: await callAnthropic(messages, system, config.anthropicKey, model), providerUsed: 'anthropic' };
    } catch (e: any) {
      errors.push(`Anthropic fallback: ${e?.message || e}`);
    }
  }

  throw new Error(
    `No AI provider available. ${errors.length ? errors.join(' | ') : 'Set OPENAI_API_KEY or ANTHROPIC_API_KEY.'}`
  );
}

/** Which provider is currently active — for display/logging only */
export function activeProviderLabel(config: ProviderConfig): string {
  if (config.primaryProvider === 'openai' && config.openaiKey)   return config.openaiModel || 'gpt-4o-mini';
  if (config.primaryProvider === 'custom' && config.customUrl)   return 'custom';
  if (config.anthropicKey) return config.anthropicModel || 'claude-sonnet-4-6';
  return 'none';
}
