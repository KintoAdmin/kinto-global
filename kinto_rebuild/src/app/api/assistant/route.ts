// @ts-nocheck
/**
 * Kinto AI — Assistant API Route
 *
 * Two bots, one route, any AI provider:
 *
 *   Kinto Guide  (modes: explainer | guidance | report | monitoring)
 *     Grounded in live platform data — scores, findings, P1 actions.
 *     Explains, sequences, and drafts. Never touches platform data.
 *
 *   Kinto Support  (mode: support)
 *     Answers feature questions, how-to, and platform knowledge.
 *
 * Provider priority:
 *   1. Your AI  (ASSISTANT_PRIMARY_PROVIDER = openai | custom)
 *   2. Anthropic Claude fallback  (ANTHROPIC_API_KEY)
 *
 * The UI always shows "Kinto AI" — provider is invisible to users.
 */

import { NextRequest } from 'next/server';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { getModuleSnapshot } from '@/lib/repositories/foundation';
import { getServerEnv } from '@/lib/env';
import { callAssistant, activeProviderLabel } from '@/lib/assistant/providers';

export const dynamic = 'force-dynamic';

type Mode = 'support' | 'explainer' | 'guidance' | 'report' | 'monitoring';
type ChatMsg = { role: 'user' | 'assistant'; content: string };

// ── Context builder ────────────────────────────────────────────────────────
function pctLabel(pct: number) {
  if (pct <= 0) return 'Not scored';
  if (pct < 40) return `Critical/Weak (${pct.toFixed(0)}%)`;
  if (pct < 65) return `Developing (${pct.toFixed(0)}%)`;
  if (pct < 80) return `Managed (${pct.toFixed(0)}%)`;
  return `Strong (${pct.toFixed(0)}%)`;
}
function s(v: unknown, max = 300) { return String(v || '').trim().slice(0, max); }

async function buildContext(assessmentId?: string, clientId?: string): Promise<string> {
  if (!assessmentId && !clientId) return '';
  try {
    const snap = await getWorkspaceSnapshot({ clientId: clientId || undefined, assessmentId: assessmentId || undefined });
    const lines: string[] = [];
    if (snap.client)     lines.push(`Client: ${s(snap.client.client_name)}${snap.client.industry ? ` (${snap.client.industry})` : ''}`);
    if (snap.assessment) lines.push(`Assessment: ${s(snap.assessment.assessment_name)}`);

    const mods = (snap.modules || []).filter((m: any) => m.module_code !== 'ROADMAP');
    if (mods.length) {
      lines.push('\nScores:');
      mods.forEach((m: any) =>
        lines.push(`  ${m.module_name}: ${pctLabel(Number(m.score_pct || 0))} | ${String(m.module_status || 'NOT_STARTED').replaceAll('_', ' ')}`)
      );
    }

    if (assessmentId) {
      const codes = ['OPS', 'LEAK', 'DATA', 'AIR', 'AIUC'] as const;
      const snaps = await Promise.allSettled(codes.map(c => getModuleSnapshot(assessmentId, c).catch(() => null)));
      lines.push('\nDetail:');
      codes.forEach((code, i) => {
        const r = snaps[i];
        const ms = r.status === 'fulfilled' ? r.value : null;
        if (!ms || Number(ms.score_pct || 0) <= 0) return;
        const narr = Array.isArray(ms.summary_payload?.executive_narrative)
          ? ms.summary_payload.executive_narrative.join(' ')
          : s(ms.summary_payload?.executive_narrative || '');
        const finds = (ms.findings_payload || [])
          .filter((f: any) => String(f.severity_band || '').match(/CRIT|HIGH|WEAK/i))
          .slice(0, 4);
        const p1 = (ms.roadmap_payload || []).filter((r: any) => r.phase_code === 'P1').slice(0, 3);
        if (!narr && !finds.length) return;
        lines.push(`\n  [${code}] ${pctLabel(Number(ms.score_pct || 0))}`);
        if (narr)    lines.push(`    ${s(narr, 350)}`);
        finds.forEach((f: any) => lines.push(`    - ${s(f.finding_title, 80)}: ${s(f.finding_narrative || f.business_impact, 130)}`));
        p1.forEach((r: any)   => lines.push(`    P1: ${s(r.initiative_title, 80)} → ${s(r.owner_role || 'TBC', 40)}`));
      });
    }
    return lines.join('\n');
  } catch { return ''; }
}

// ── System prompts ─────────────────────────────────────────────────────────
const BOUNDARY = `\nNon-negotiable rules:\n- NEVER change scores, modify data, or take any platform action\n- Always reference actual data from the context — never invent client-specific figures\n- If you don't have the information to answer specifically, say so clearly`;

const PROMPTS: Record<Mode, string> = {
  support: `You are the Kinto Support assistant — the helpful guide for the Kinto Global business diagnostic platform.
Answer questions about how the platform works, what modules cover, what features do, and how to interpret results.

Platform knowledge:
- Five modules: Operational Audit (OPS), Revenue Leakage (LEAK), Data Foundation (DATA), AI Readiness (AIR), AI Use Cases (AIUC)
- Scores: 1–5 per question → percentage → band: Critical/Weak <40%, Developing 40–65%, Managed 65–80%, Strong 80%+
- Diagnostic score and implementation progress are always kept separate — scoring findings versus executing improvements
- Advisory tab per module shows findings, recommendations, actions in priority order
- Transformation Roadmap is the live implementation tracker — P1/P2/P3 phases
- Reports generate as DOCX and PPTX — integrated (all modules) or standalone (one module)
- AIUC is a prioritisation engine driven by OPS, DATA, AIR scores — use cases are Pilot Ready, Conditionally Ready, or Blocked
- Single-module engagements are complete advisory work, not partial${BOUNDARY}`,

  explainer: `You are the Kinto Guide — a contextual explainer for the Kinto business diagnostic platform.
Explain what users are looking at: scores, findings, maturity bands, dependencies, blocked use cases.

How to respond:
- Name the actual module, score, and finding from the context — never be generic
- Plain business language — users are consultants and business leaders
- One clear paragraph per concept — be concise
- Explain commercial consequence, not just technical facts${BOUNDARY}`,

  guidance: `You are the Kinto Guide — a priority sequencing advisor for the Kinto platform.
Give a clear ordered answer to "what should we do next?".

How to respond:
- Start with the highest-priority P1 action from the context — name it specifically
- Explain WHY it is first — what risk it addresses, what it unlocks
- Give the next 2–3 actions in sequence with brief rationale
- For single-module engagements: treat it as a complete programme, not partial
- End with: "Start with: [specific action]"
- Never re-order the priority sequence the platform already determined${BOUNDARY}`,

  report: `You are the Kinto Guide — a writing assistant for business diagnostic outputs.
Help draft and improve executive summaries, sponsor briefings, and narrative sections.

How to respond:
- Open executive summaries with the business consequence, not the diagnostic score
- Label all drafted content: "Draft:" so users know it needs review
- Consulting tone: specific, commercially aware, not generic
- Ground every draft in the actual findings and scores from the context
- Keep it to what was asked — no padding${BOUNDARY}`,

  monitoring: `You are the Kinto Guide — a platform health analyst.
Spot patterns, flag inconsistencies, and triage issues in the engagement.

How to respond:
- Identify what looks stuck, incomplete, or inconsistent
- Frame as "this may indicate..." — not definitive diagnoses
- Suggest likely causes from what you can see
- Specific observations, not vague concerns
- Never take automated action — observe and suggest only${BOUNDARY}`,
};

function buildPrompt(mode: Mode, ctx: string): string {
  const ctxBlock = ctx ? `\n\n## Assessment context (read-only)\n${ctx}` : '';
  return PROMPTS[mode] + ctxBlock;
}

// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Load env — resolve provider config
  let env: ReturnType<typeof getServerEnv>;
  try { env = getServerEnv(); }
  catch (e: any) {
    return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const config = {
    primaryProvider:  env.ASSISTANT_PRIMARY_PROVIDER,
    openaiKey:        env.OPENAI_API_KEY,
    openaiModel:      env.OPENAI_MODEL,
    customUrl:        env.ASSISTANT_CUSTOM_URL,
    customApiKey:     env.ASSISTANT_CUSTOM_API_KEY,
    anthropicKey:     env.ANTHROPIC_API_KEY,
    anthropicModel:   env.ANTHROPIC_MODEL,
  };

  const hasProvider = config.openaiKey || config.customUrl || config.anthropicKey;
  if (!hasProvider) {
    return new Response(
      JSON.stringify({
        error: 'Kinto AI is not configured. Add OPENAI_API_KEY (or ANTHROPIC_API_KEY) to your environment to enable the assistant.',
        code: 'ASSISTANT_NOT_CONFIGURED',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { message, mode = 'support', assessmentId, clientId, messages = [] } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const ctx      = await buildContext(assessmentId, clientId);
    const system   = buildPrompt(mode as Mode, ctx);
    const history: ChatMsg[] = [
      ...(messages as ChatMsg[]).slice(-10),
      { role: 'user', content: message.trim() },
    ];

    const { stream } = await callAssistant(history, system, config);

    return new Response(stream, {
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'Cache-Control':     'no-cache, no-store',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Kinto AI encountered an error. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
