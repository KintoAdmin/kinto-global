# Kinto Global — SaaS & Multi-User Roadmap
**Date:** 2026-03-31

This document defines the complete work required to take Kinto from its current 
single-consultant model to a commercially licensable, multi-tenant, subscription-based 
online product.

---

## The gap between now and SaaS

The current build is a consulting delivery tool. One operator, one Supabase project, 
service role key used for everything. It works well for that model.

A SaaS product requires:
- **Tenant isolation** — each customer's data is invisible to every other customer
- **User accounts** — consultants log in, clients optionally log in to view their reports
- **Subscription billing** — access controlled by plan tier
- **Self-service onboarding** — a new consultant can sign up and start without you
- **Operational reliability** — it must not go down, lose data, or expose one customer to another

None of these are bolt-ons. They require architectural changes that must be done in sequence.

---

## Sprint roadmap — 6 phases

---

### Phase 1 — Authentication & identity (4–6 weeks)
**Goal:** Every user logs in. Sessions are real. The service role key is never exposed to the browser.

**Technical work:**

1. **Supabase Auth** — enable email/password and optionally Google OAuth
   ```
   supabase.auth.signUp({ email, password })
   supabase.auth.signInWithPassword({ email, password })
   ```
   Store the user's `auth.users.id` as the `consultant_id` on the `clients` and `assessments` tables.

2. **Session middleware** — add Next.js middleware to check the session on every request
   ```
   src/middleware.ts — redirect to /login if no valid session
   ```
   Use `@supabase/ssr` to handle cookie-based sessions correctly in App Router.

3. **Login and register pages** — `/login`, `/register`, `/forgot-password`

4. **Auth context** — server-side session in layouts, no client-side session calls on initial render

5. **Remove service role key from all client-side code** — currently it only exists server-side, which is correct. Audit and lock this.

**Deliverable:** Consultant can sign up, log in, and access their own workspace. Unauthenticated users are redirected to login.

---

### Phase 2 — Tenant isolation (3–4 weeks)
**Goal:** Consultant A cannot see Consultant B's clients, assessments, or reports. Ever.

**Technical work:**

1. **Add `consultant_id` column to every tenant-scoped table:**
   - `clients`
   - `assessments`
   - `assessment_modules`
   - `finding_instances`
   - `recommendation_instances`
   - `action_instances`
   - `roadmap_facts`
   - `module_snapshots`
   - `report_instances`
   - `report_artifacts`
   - `module_publications`

2. **Row Level Security (RLS) policies on all tenant tables:**
   ```sql
   -- Example for clients table
   CREATE POLICY "consultant_own_clients" ON clients
     FOR ALL USING (consultant_id = auth.uid());
   ```
   Every table gets a policy: `consultant_id = auth.uid()`.

3. **Switch all read/write operations from service role to authenticated client:**
   The admin client (service role) should only be used for:
   - Reference data reads (library content — shared across all tenants)
   - Report artifact storage operations
   - Background jobs (server-side only, never in browser)
   
   All other operations use the session-scoped Supabase client.

4. **Seed `consultant_id` on all existing rows** — migration script for any existing data.

5. **Test isolation** — create two test consultants, verify neither can see the other's data at any API endpoint.

**Deliverable:** Complete data isolation between consultant accounts. Passing RLS policy test suite.

---

### Phase 3 — Role model (2–3 weeks)
**Goal:** Three roles with different access levels.

**Role definitions:**

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Admin** | Everything. Manage users, see all clients, configure billing. | — |
| **Consultant** | Create/edit/delete their own clients and assessments. Generate reports. | See other consultants' data. |
| **Viewer (Client)** | Read their own assessment reports. Download PDFs. | Edit anything. See other clients. |

**Technical work:**

1. **User roles table:**
   ```sql
   CREATE TABLE user_roles (
     user_id UUID REFERENCES auth.users,
     role TEXT CHECK (role IN ('admin', 'consultant', 'viewer')),
     client_id UUID REFERENCES clients -- for viewer: which client they belong to
   );
   ```

2. **JWT custom claims** — set role in Supabase Auth JWT so RLS policies can read it:
   ```sql
   -- In a Postgres function called on auth.users update
   UPDATE auth.users SET raw_app_meta_data = 
     raw_app_meta_data || jsonb_build_object('role', 'consultant')
   WHERE id = NEW.id;
   ```

3. **RLS policies extended with role checks:**
   ```sql
   -- Viewers can only read assessments linked to their client_id
   CREATE POLICY "viewer_own_assessment" ON assessments
     FOR SELECT USING (
       client_id IN (
         SELECT client_id FROM user_roles 
         WHERE user_id = auth.uid() AND role = 'viewer'
       )
     );
   ```

4. **UI route guards** — middleware checks role and redirects accordingly:
   - Viewer → `/client-portal` (read-only report view)
   - Consultant → `/workspace` (full tool)
   - Admin → `/admin` (management panel)

5. **Client portal pages** — simple read-only views for Viewer role:
   - Assessment summary
   - Report download
   - Roadmap progress view (read-only)

**Deliverable:** Working three-role model. Client can log in and view their own report without seeing the full tool.

---

### Phase 4 — Subscription billing (3–4 weeks)
**Goal:** Access is controlled by subscription plan. Billing is automated.

**Recommended stack:** Stripe + Supabase Edge Functions

**Plan structure (suggested):**

| Plan | Price | Limits | Features |
|------|-------|--------|----------|
| Starter | R 2,500/mo | 3 active clients, 1 consultant | All 5 modules, reports |
| Professional | R 6,500/mo | 10 active clients, 3 consultants | All modules, white-label reports, client portal |
| Enterprise | Custom | Unlimited | Custom branding, SSO, dedicated support |

**Technical work:**

1. **Stripe integration:**
   - Create products and prices in Stripe Dashboard
   - `npm install stripe`
   - Webhook endpoint: `/api/billing/webhook` — handles `customer.subscription.created/updated/deleted`

2. **Subscription table in Supabase:**
   ```sql
   CREATE TABLE subscriptions (
     consultant_id UUID REFERENCES auth.users,
     stripe_customer_id TEXT,
     stripe_subscription_id TEXT,
     plan_id TEXT,
     status TEXT, -- active, trialing, past_due, cancelled
     current_period_end TIMESTAMPTZ,
     client_limit INT,
     consultant_limit INT
   );
   ```

3. **Subscription gate middleware:**
   ```typescript
   // Before every workspace page load:
   const sub = await getSubscription(userId);
   if (!sub || sub.status !== 'active') redirect('/billing');
   if (clientCount >= sub.client_limit) showUpgradePrompt();
   ```

4. **Billing portal pages:**
   - `/billing` — current plan, usage, upgrade/downgrade
   - `/billing/success` — post-checkout confirmation
   - Use Stripe Customer Portal for invoice history and payment method management

5. **Trial period:** 14-day free trial, no credit card required. Auto-email at day 10 and day 13.

6. **Metered usage tracking:** Record `assessment_created`, `report_generated` events to Supabase for billing and analytics.

**Deliverable:** New consultants can sign up, choose a plan, pay with Stripe, and access the tool. Subscription controls feature access. Failed payments degrade gracefully.

---

### Phase 5 — Self-service onboarding (2 weeks)
**Goal:** A new consultant can sign up and be useful within 10 minutes without your involvement.

**Technical work:**

1. **Onboarding flow** — after signup, guided steps:
   - Step 1: Create your first client (name, industry, size)
   - Step 2: Start a new assessment
   - Step 3: Try the OPS or LEAK module (suggested based on industry)
   - Step 4: Generate your first report
   - Each step has a progress indicator and a "skip" option

2. **Empty states** — every page should have a useful empty state:
   - No clients: "Create your first client to get started"
   - No assessments: "Create an assessment for [client name]"
   - No roadmap: "Complete module scoring to generate the roadmap"

3. **Email sequences (transactional):**
   - Welcome email: what Kinto does, how to start
   - Day 3: "Have you tried the Revenue Leakage module?"
   - Day 7: "Generate your first report"
   - Day 10 (trial): "Your trial ends in 4 days"

4. **In-app help:**
   - Tooltip on every major action
   - Module explainer modals ("What does Operational Audit cover?")
   - Sample/demo client with pre-filled data so users can see what outputs look like

5. **Demo mode:** A read-only pre-filled assessment showing what a complete engagement looks like — so a prospective customer can evaluate without having to do the work first.

**Deliverable:** A new user can sign up, explore, and complete their first module without any human help.

---

### Phase 6 — Production infrastructure (3–4 weeks)
**Goal:** The product is reliable, observable, and recoverable.

**Technical work:**

1. **Deployment architecture:**
   ```
   Next.js → Vercel (recommended) or Railway
   Python engine → Railway or Render (persistent server, not serverless)
   Supabase → Supabase Cloud Pro (PITR enabled)
   Report artifacts → Supabase Storage or AWS S3
   ```

2. **Environment management:**
   - Three environments: `development`, `staging`, `production`
   - Each has its own Supabase project
   - Deploy to staging first, then promote to production
   - Use Vercel preview deployments for feature branches

3. **Error monitoring:** Sentry — free tier is sufficient initially
   ```bash
   npm install @sentry/nextjs
   ```
   Set `SENTRY_DSN` in production environment.

4. **Logging:** Structured JSON logs to stdout. Vercel and Railway both capture these automatically.

5. **Performance monitoring:** Vercel Analytics for frontend, Supabase Dashboard for DB query performance.

6. **Backup strategy:**
   - Supabase Pro: automatic daily backups + PITR (point-in-time recovery up to 7 days)
   - Report artifacts: S3 versioning enabled
   - Test restore procedure monthly

7. **Domain and SSL:** Custom domain (app.kintoglobal.com), SSL via Vercel or Cloudflare.

8. **Rate limiting:** Protect API routes from abuse:
   ```typescript
   // In middleware.ts
   // Rate limit: 100 requests per minute per IP
   ```

9. **GDPR/POPIA compliance basics:**
   - Privacy policy and terms of service pages
   - Data processing agreement template for clients
   - Ability to delete a client and all their data (RTBF — Right to be Forgotten)
   - Data stored in appropriate region (EU or ZA depending on client base)

**Deliverable:** Production environment live, monitored, backed up, and recoverable.

---

## Total timeline estimate

| Phase | Duration | Depends on |
|-------|----------|------------|
| Phase 1 — Auth | 4–6 weeks | Nothing |
| Phase 2 — Tenant isolation | 3–4 weeks | Phase 1 |
| Phase 3 — Role model | 2–3 weeks | Phase 1 & 2 |
| Phase 4 — Billing | 3–4 weeks | Phase 1 |
| Phase 5 — Onboarding | 2 weeks | Phase 1–4 |
| Phase 6 — Infrastructure | 3–4 weeks | Can run parallel |
| **Total** | **~5–6 months** | With one focused developer |

Phases 1–2 are the critical path. Nothing else works properly without auth and isolation.
Phases 3 and 4 can be developed in parallel once Phase 1 is done.

---

## Technology decisions

**Keep:**
- Next.js App Router — correct choice for this type of app
- Supabase — the RLS system is exactly what you need for tenant isolation
- Python engine for report artifacts — keep isolated, don't merge into Next.js

**Add:**
- Stripe — industry standard, best SDK quality, easiest for ZAR + international
- Sentry — cheapest reliable error monitoring
- Resend or Postmark — transactional email (welcome, trial, billing alerts)
- Vercel — simplest deployment for Next.js, generous free tier

**Do not add yet:**
- Redis/caching layer — Supabase is fast enough until you have hundreds of concurrent users
- Separate auth service — Supabase Auth is sufficient for this scale
- Kubernetes/containers — overkill until you have > 50 concurrent users
- Custom analytics — Vercel Analytics covers what you need initially

---

## Cost estimate at scale

Monthly infrastructure cost at ~50 paying customers:

| Service | Cost/month |
|---------|-----------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Railway (Python engine) | $10–20 |
| Sentry (free tier) | $0 |
| Resend (transactional email) | $0–20 |
| Stripe fees | ~2.9% + R0.30 per transaction |
| **Total** | **~$55–85/month** |

At R 2,500/month per Starter customer, 50 customers = R 125,000 MRR against ~R 1,500 infrastructure cost. Infrastructure is not the cost driver.

---

## What to prioritise first

**Build Phase 1 immediately.** Nothing else is safe without authentication. Every day the tool is live without auth is a day where data isolation depends purely on URL obscurity.

**Phase 2 in the same sprint as Phase 1.** Auth without RLS gives you login but not real isolation.

**Phase 4 (billing) in parallel with Phase 3.** Revenue starts when you turn on Stripe. The role model can ship slightly after billing — Viewers can be added in a subsequent sprint.

The recommended launch sequence:
1. Soft launch to 5 beta consultants (Phase 1 + 2 only) — validate product-market fit
2. Add billing (Phase 4) and go live publicly — R 0 trial → paid conversion
3. Add client portal (Phase 3) as a Professional plan differentiator
4. Onboarding polish (Phase 5) after you have 10+ active customers and understand the friction points
5. Full production infrastructure (Phase 6) before you hit 30+ concurrent users

---

## What stays the same

The diagnostic engine, advisory generation, report builder, and transformation roadmap are 
already built and working. None of that needs to change for SaaS. The SaaS work is entirely 
infrastructure, access control, and billing — wrapped around the product that already exists.

