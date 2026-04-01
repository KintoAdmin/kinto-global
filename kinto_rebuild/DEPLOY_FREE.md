# Kinto Global — Free Deployment Guide
**Goal:** Get the platform online for as close to R0/month as possible.

---

## What the platform needs to run

Three things must be hosted:

| Piece | What it does | Free option |
|-------|-------------|-------------|
| Next.js app | The interface and all business logic | Vercel (free tier) |
| Python engine | Generates Word/PowerPoint files | Railway ($5 credit/month free) |
| Database | Stores all client data | Supabase (free tier) |

Total cost with the setup below: **R0/month** for light use.

---

## Part 1 — Database (Supabase) — Free forever

Supabase's free tier gives you a full PostgreSQL database, 500MB storage, and 2GB bandwidth.
That is more than enough for dozens of client assessments.

**Step 1.1 — Create your Supabase project**

Go to [supabase.com](https://supabase.com) and sign up with your GitHub or Google account.
Click "New project." Give it the name `kinto-global`. Choose any region close to you.
Set a database password and save it somewhere safe.

**Step 1.2 — Run the migrations**

In your Supabase project, click "SQL Editor" in the left sidebar.
Open each file from the `supabase/migrations/` folder in your build and paste it in, then click Run:

```
001_platform_foundation.sql
002_interoperability_foundation.sql
003_report_delivery_layer.sql
004_shared_persistence_snapshot_layer.sql
```

Run them in that order. Each should complete without errors.

**Step 1.3 — Get your keys**

Go to Project Settings → API. You need three values — keep them open for later:
- Project URL  
- anon/public key  
- service_role key (this one is sensitive — never put it in public code)

**Free tier limits:** Supabase pauses inactive projects after 7 days on the free tier.
To prevent this, either upgrade to Pro ($25/month) or ping the project regularly.
For a live consulting tool you are actively using, the free tier is fine — you will be
using it often enough that it never pauses.

---

## Part 2 — Next.js app (Vercel) — Free forever

Vercel is the company that makes Next.js. Their free tier is genuinely generous and
is the standard way to host Next.js apps. Bandwidth and serverless function calls
are more than sufficient for a single-consultant tool.

**Step 2.1 — Push your code to GitHub**

Create a free GitHub account if you don't have one.
Create a new private repository called `kinto-global`.

In the project folder on your machine:

```bash
git init
git add .
git commit -m "Initial build v1.0.0-rc.4"
git remote add origin https://github.com/YOUR_USERNAME/kinto-global.git
git push -u origin main
```

**Step 2.2 — Deploy on Vercel**

Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
Click "Add New Project." Select your `kinto-global` repository.

Vercel will detect it as a Next.js app automatically. Before clicking Deploy,
click "Environment Variables" and add these:

```
NEXT_PUBLIC_SUPABASE_URL          = (your Supabase Project URL)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = (your Supabase anon key)
SUPABASE_SERVICE_ROLE_KEY         = (your Supabase service_role key)
PYTHON_API_BASE_URL               = (leave blank for now — add after Part 3)
NODE_ENV                          = production
NEXT_PUBLIC_APP_URL               = https://YOUR-PROJECT.vercel.app
```

For the AI assistant (optional — the app works without it):
```
ANTHROPIC_API_KEY                 = (your Anthropic key if you have one)
```

Click Deploy. Vercel builds and deploys automatically. Takes 2–3 minutes.
Your app is live at `https://YOUR-PROJECT-NAME.vercel.app`.

**Step 2.3 — Seed the reference data**

Once deployed, you need to load the module libraries into the database.
Do this from your local machine (you need Node.js installed):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npm run seed:reference
```

You only do this once. It loads all the question libraries, findings, recommendations,
and action content into the database.

**Free tier limits:** Vercel free tier allows 100GB bandwidth/month and unlimited deployments.
The only potential cost is if report generation (the Python engine) times out on Vercel's
10-second serverless function limit. This is why the Python engine runs separately.

---

## Part 3 — Python engine (Railway) — Free with $5 credit

The Python engine only runs when generating Word or PowerPoint reports.
It is not needed for scoring, advisory, or roadmap work.
Railway gives you $5 of free credit every month. The engine uses very little —
typically under $0.50/month for light use.

**Step 3.1 — Create a Railway account**

Go to [railway.app](https://railway.app) and sign in with your GitHub account.

**Step 3.2 — Deploy the Python engine**

In Railway, click "New Project" → "Deploy from GitHub repo."
Select your `kinto-global` repository.

Railway will try to auto-detect the start command. You need to override it.
In the service settings, set:

```
Root Directory:  python_engine
Start Command:   python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Railway sets `PORT` automatically. The engine listens on whatever port it is given.

Click Deploy. Railway builds and starts the service. Takes about 2 minutes.

**Step 3.3 — Get the Railway URL**

Once deployed, Railway gives you a public URL like `https://kinto-python-engine.up.railway.app`.
Copy it.

Go back to your Vercel project → Settings → Environment Variables.
Add:
```
PYTHON_API_BASE_URL = https://kinto-python-engine.up.railway.app
```

Then redeploy on Vercel (Settings → Deployments → Redeploy).

**Free tier limits:** $5 credit per month. The Python engine idles when not in use,
so it only costs money when generating reports. At $0.000463/GB-hour, you would need
to generate roughly 500 reports per month to exhaust the $5 credit. You will not
come close to this in early use.

---

## Part 4 — Custom domain (optional, free)

Vercel gives you a `.vercel.app` subdomain for free.
If you want `app.kintoglobal.com` or similar, you need a domain.

Domain cost: ~R200/year from [domains.co.za](https://domains.co.za) or ~$12/year from Namecheap.

Once you have a domain:
- Go to Vercel → Your Project → Settings → Domains
- Add your domain
- Follow the DNS instructions (takes 10–60 minutes to propagate)

This is the only thing that costs money in this setup, and it is annual not monthly.

---

## Summary — total monthly cost

| Service | Cost | Notes |
|---------|------|-------|
| Supabase | R0 | Free tier — 500MB, pauses after 7 days inactive |
| Vercel | R0 | Free tier — unlimited deployments, 100GB bandwidth |
| Railway | R0 | $5 credit/month — Python engine uses <$0.50 |
| Domain | R0 | Optional — use the free vercel.app subdomain |
| **Total** | **R0/month** | For a single consultant in active use |

---

## When it stops being free

You will outgrow the free tier when:

**Supabase free tier** — database exceeds 500MB, or you need it never to pause.
Upgrade: Supabase Pro = $25/month. You can comfortably run 50+ assessments before hitting storage limits.

**Vercel free tier** — you exceed 100GB bandwidth or need team access (more than one person deploying).
Upgrade: Vercel Pro = $20/month. You will not hit the bandwidth limit in early use.

**Railway** — you use more than $5 of compute. Unlikely in early use.

**Realistic upgrade point:** When you have 3–5 active clients running simultaneous assessments
and need the database to always be available. That is probably Supabase Pro ($25/month) only.

---

## One-time setup checklist

- [ ] Supabase project created and migrations run
- [ ] Vercel project deployed with all environment variables set
- [ ] Reference data seeded (`npm run seed:reference` from local machine)
- [ ] Railway Python engine deployed and URL added to Vercel
- [ ] Vercel redeployed after adding Python URL
- [ ] Open the live URL and create your first test client
- [ ] Score a few questions and confirm advisory outputs appear
- [ ] Generate a report and confirm DOCX downloads

---

## Getting a custom URL right now without a domain

Vercel gives you something like `kinto-global-abc123.vercel.app`.
You can make it cleaner by going to Vercel → Project Settings → General → Project Name
and changing it to `kinto-global` or `kinto-app`.
Your URL becomes `kinto-global.vercel.app` — no domain purchase needed.

