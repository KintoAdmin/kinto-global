# Kinto Global — Operations Runbook
**Version:** 1.0.0-rc.1  
**Last updated:** 2026-03-31

---

## 1. System Overview

Kinto Global is a Next.js 14 frontend with a Python FastAPI engine for report generation. Data is stored in Supabase (PostgreSQL). The frontend calls Supabase directly via the admin client for all save/read operations. Python is used only for DOCX/PPTX artifact generation.

```
Browser → Next.js (App Router) → Supabase (PostgreSQL)
                              → Python FastAPI (report artifacts only)
```

---

## 2. Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| Node.js | 18.x or 20.x | Required for Next.js 14 |
| Python | 3.10+ | For report artifact generation |
| Supabase | Hosted or self-hosted | PostgreSQL + Storage |

Python dependencies: `python-docx`, `python-pptx`

---

## 3. Local Development Setup

```bash
# 1. Clone and install
git clone <repo> kinto-global
cd kinto-global
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Install Python dependencies
pip install python-docx python-pptx --break-system-packages
# Or with venv:
python3 -m venv .venv
source .venv/bin/activate
pip install python-docx python-pptx

# 4. Run dev stack
npm run dev:full     # Starts Next.js + Python FastAPI together

# 5. Verify
open http://localhost:3000
```

---

## 4. Deployment

### Staging / Production — Next.js

```bash
npm run build        # Builds Next.js for production
npm run start        # Starts production server on port 3000
```

Recommended: deploy to Vercel, Railway, or any Node.js host.  
Set all environment variables in the platform dashboard — never commit `.env.local`.

### Python Engine

```bash
# Production start (from python_engine directory)
cd python_engine
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

Set `PYTHON_API_BASE_URL` in Next.js environment to point to the deployed Python service URL.

### Report Artifacts

Report artifacts (DOCX, PPTX) are generated on-demand by the Python engine and stored at the path defined by `REPORT_ARTIFACTS_DIR`. In production, ensure this directory is on a persistent volume — not inside the deployment bundle.

---

## 5. Rollback Procedure

```bash
# 1. Identify last known-good build tag
git tag -l

# 2. Checkout and rebuild
git checkout v1.0.0-rc.1
npm install && npm run build

# 3. Restart server
npm run start
```

For Supabase schema changes: use Supabase migrations. Never run schema changes directly against production without a tested rollback script.

---

## 6. Database Backup & Restore

Supabase provides automated point-in-time recovery (PITR) on Pro and Team plans.

**Manual backup:**
```bash
# Export via Supabase CLI
supabase db dump --file backup_$(date +%Y%m%d).sql
```

**Restore:**
```bash
supabase db reset --db-url $SUPABASE_DB_URL < backup_20260101.sql
```

---

## 7. Health Checks

```bash
# Next.js app
curl http://localhost:3000/api/health

# Python engine
curl http://localhost:8000/health

# Full system QA
npm run qa:full-system

# E2E diagnostic suite
node e2e/kinto-diagnostics.mjs
```

---

## 8. Role and Permission Model

Kinto currently uses a **single-tenant admin model** — all DB operations use the Supabase service role key (bypasses RLS). This is appropriate for the current consulting delivery use case where one operator (the consultant) manages all clients and assessments.

**For multi-tenant or client-access deployment, the following controls must be added before go-live:**

| Role | Access | Implementation required |
|---|---|---|
| Admin / Consultant | Full read/write across all clients and assessments | Current state |
| Viewer / Client | Read-only access to their own assessment reports | Supabase RLS policies on `client_id` + Auth |
| Editor | Write access to specific assessments | Supabase RLS + Auth claims |

Until multi-tenant auth is implemented, do not expose the application publicly. Operate as an internal consultant tool behind a VPN or access control layer.

---

## 9. Monitoring

### Error logging (production)

Configure Sentry by setting `SENTRY_DSN` in the environment. Without Sentry, errors are logged to stdout only.

```bash
# View Next.js error logs
journalctl -u kinto-global -f   # (systemd)
docker logs kinto-app -f         # (Docker)
```

### Key metrics to monitor

- P95 save response time (target: < 500ms)
- Report generation success rate (target: > 95%)
- Python engine availability
- Supabase connection pool saturation

---

## 10. Release Checklist

Before tagging any release:

- [ ] `npm run typecheck` — 0 real errors
- [ ] `npm run qa:full-system` — all passes
- [ ] `node e2e/kinto-diagnostics.mjs` — all passes
- [ ] All 5 modules save and render correctly on a real assessment
- [ ] Reports and PPTX generate without errors
- [ ] Roadmap generate/regenerate works end to end
- [ ] `.env.example` is current and complete
- [ ] `CHANGELOG.md` updated
- [ ] `package.json` version bumped
- [ ] No secrets committed to git

---

## 11. Known Limitations (RC1)

| Area | Current state | Planned |
|---|---|---|
| Multi-tenant auth | Single tenant, admin key only | Future: Supabase Auth + RLS |
| Role model | No per-user roles | Future: Admin / Editor / Viewer |
| Async report generation | Synchronous (~27s for full publication) | Future: background job queue |
| Report artifact storage | Local filesystem | Future: Supabase Storage or S3 |
| Monitoring | Stdout logging only | Future: Sentry integration |

These limitations are non-blocking for the current consulting delivery use case. They are blocking for public SaaS or multi-client self-service.

