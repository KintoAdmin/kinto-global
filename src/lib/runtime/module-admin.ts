import { createClient } from '@supabase/supabase-js';

export function getEnv(name: string) {
  return process.env[name] || '';
}

export function getSupabaseAdmin() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const serviceKey =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SECRET_KEY') ||
    getEnv('SUPABASE_SERVICE_KEY');

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin environment variables.');
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function getActiveAssessmentId(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from('assessments')
    .select('assessment_id')
    .order('assessment_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.assessment_id) throw new Error('No assessment found.');
  return data.assessment_id as string;
}

export function scoreBandFromScore(score: number) {
  if (score <= 2) return '1-2';
  if (score === 3) return '3';
  return '4-5';
}

export function bandFromPct(scorePct: number | null, hasData: boolean = true) {
  // Band shows quality of what has been scored, regardless of completion.
  // Use completion_pct separately to track how much of the assessment is done.
  if (!hasData || scorePct === null || scorePct === 0) return 'NOT_SCORED';
  if (scorePct < 40) return 'WEAK';
  if (scorePct < 60) return 'DEVELOPING';
  if (scorePct < 80) return 'MANAGED';
  return 'STRONG';
}

export function phaseTextToCode(input?: string | null) {
  const value = String(input || '').toLowerCase();
  if (value.includes('phase 2') || value.includes('p2') || value.includes('standardise')) {
    return { code: 'P2', name: 'Standardise and Strengthen' };
  }
  if (value.includes('phase 3') || value.includes('p3') || value.includes('optimize') || value.includes('optimise') || value.includes('ai-enable')) {
    return { code: 'P3', name: 'Optimize, Automate, and AI-Enable' };
  }
  return { code: 'P1', name: 'Stabilise and Protect' };
}

export function ragFromScore(scorePct: number) {
  if (scorePct < 40) return 'RED';
  if (scorePct < 70) return 'AMBER';
  return 'GREEN';
}
