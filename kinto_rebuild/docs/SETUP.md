# Setup

1. Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PYTHON_API_BASE_URL=http://127.0.0.1:8000
```

2. In Supabase SQL Editor run these in order:
- `supabase/migrations/001_platform_foundation.sql`
- `supabase/migrations/002_interoperability_foundation.sql`

3. Install Node dependencies:

```bash
npm install
```

4. Seed reference data:

```bash
npm run seed:reference
```

5. Install Python engine dependencies:

```bash
python -m pip install -r python_engine/requirements.txt
```

6. Start the Python engine in terminal 1:

```bash
npm run py:dev
```

7. Start Next.js in terminal 2:

```bash
npm run dev
```

Optional single-command start:

```bash
npm run dev:full
```


## Report delivery layer
- Apply the new Supabase migration `supabase/migrations/003_report_delivery_layer.sql`.
- Re-run `pip install -r python_engine/requirements.txt` to install `python-docx` and `python-pptx`.
- Generated report artifacts are written under `runtime_artifacts/reports/` and surfaced through the Reports page as DOCX/PPTX downloads.


4. Apply `supabase/migrations/004_shared_persistence_snapshot_layer.sql` to enable canonical fact tables and snapshot-only reads for the rebuilt shared persistence layer.
