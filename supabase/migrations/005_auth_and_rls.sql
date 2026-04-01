-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 005 — Authentication and Row Level Security
-- Run this AFTER setting up Supabase Auth (Authentication → Users)
-- ══════════════════════════════════════════════════════════════════════════════

-- Step 1: Add consultant_id to tenant-scoped tables
-- This links every piece of data to the user who created it.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES auth.users(id);

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES auth.users(id);

-- Assessments inherit consultant_id from their parent client — index for performance
CREATE INDEX IF NOT EXISTS idx_clients_consultant ON public.clients(consultant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_consultant ON public.assessments(consultant_id);


-- Step 2: Enable Row Level Security on all tenant tables
-- RLS means Supabase will automatically filter rows based on the logged-in user.

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finding_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_measure_tracker ENABLE ROW LEVEL SECURITY;

-- Snapshot tables
ALTER TABLE public.assessment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_module_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_domain_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_question_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_metric_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_roadmap_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_progress_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_publications ENABLE ROW LEVEL SECURITY;


-- Step 3: RLS policies — consultants see only their own data
-- The service_role key bypasses RLS (used in admin.ts for reference data and seeding).
-- The anon/user key is scoped by these policies.

-- Clients: own your own
CREATE POLICY "consultant_own_clients" ON public.clients
  FOR ALL USING (consultant_id = auth.uid());

-- Assessments: own your own
CREATE POLICY "consultant_own_assessments" ON public.assessments
  FOR ALL USING (consultant_id = auth.uid());

-- Everything else: accessible if the assessment_id belongs to your assessment
-- We use a helper function so the policy is clean and readable.

CREATE OR REPLACE FUNCTION public.is_own_assessment(p_assessment_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments
    WHERE assessment_id = p_assessment_id
    AND consultant_id = auth.uid()
  );
$$;

-- Apply the helper to all assessment-linked tables
CREATE POLICY "own_assessment_modules"          ON public.assessment_modules          FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_finding_instances"           ON public.finding_instances           FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_recommendation_instances"    ON public.recommendation_instances    FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_action_instances"            ON public.action_instances            FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_roadmap_instances"           ON public.roadmap_instances           FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_domain_scores"               ON public.domain_scores               FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_module_scores"               ON public.module_scores               FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_question_responses"          ON public.question_responses          FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_metric_captures"             ON public.metric_captures             FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_report_instances"            ON public.report_instances            FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_report_artifacts"            ON public.report_artifacts            FOR ALL USING (is_own_assessment(report_instance_id::TEXT));
CREATE POLICY "own_success_measures"            ON public.success_measure_tracker     FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_assessment_snapshots"        ON public.assessment_snapshots        FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_module_snapshots"            ON public.assessment_module_snapshots FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_domain_snapshots"            ON public.assessment_domain_snapshots FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_question_facts"              ON public.assessment_question_facts   FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_metric_facts"                ON public.assessment_metric_facts     FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_roadmap_facts"               ON public.assessment_roadmap_facts    FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_progress_facts"              ON public.assessment_progress_facts   FOR ALL USING (is_own_assessment(assessment_id));
CREATE POLICY "own_publications"                ON public.module_publications         FOR ALL USING (is_own_assessment(assessment_id));

-- Reference data (modules, reference_records) — readable by all authenticated users
-- These are shared library content, not tenant data.
CREATE POLICY "authenticated_read_modules"
  ON public.modules FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_reference"
  ON public.reference_records FOR SELECT USING (auth.role() = 'authenticated');


-- Step 4: If you have existing data (from before auth was added),
-- assign it to a specific user. Replace 'your-user-id-here' with your actual user ID
-- from the Supabase Authentication dashboard.
--
-- UNCOMMENT AND RUN THIS ONCE AFTER CREATING YOUR FIRST ACCOUNT:
--
-- UPDATE public.clients     SET consultant_id = 'your-user-id-here' WHERE consultant_id IS NULL;
-- UPDATE public.assessments SET consultant_id = 'your-user-id-here' WHERE consultant_id IS NULL;


-- ══════════════════════════════════════════════════════════════════════════════
-- Verification queries — run these to confirm setup is correct
-- ══════════════════════════════════════════════════════════════════════════════
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT policyname, tablename, cmd FROM pg_policies ORDER BY tablename;
