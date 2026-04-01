from __future__ import annotations

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse

from .engines.audit import load_operational_audit, update_metric, update_question, bulk_score
from .engines.generic import load_module, save_score
from .engines.leakage import load_revenue_leakage, update_revenue_leakage
from .settings import get_settings
from .supabase_rest import SupabaseRestError

app = FastAPI(title='Kinto Python Engine', version='1.0.0')


@app.exception_handler(SupabaseRestError)
async def handle_supabase_error(_: Request, exc: SupabaseRestError):
    return JSONResponse(status_code=500, content={'ok': False, 'error': str(exc), 'details': exc.payload})


@app.exception_handler(RuntimeError)
async def handle_runtime_error(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=400, content={'ok': False, 'error': str(exc)})


@app.get('/health')
async def health():
    settings = get_settings()
    return {'status': 'ok', 'python_api_base_url': settings.python_api_base_url}


@app.get('/data-foundation')
async def data_foundation_get(assessmentId: str | None = Query(default=None)):
    return await load_module('data-foundation', assessmentId)


@app.post('/data-foundation')
async def data_foundation_post(body: dict):
    payload = await save_score('data-foundation', body.get('assessmentId'), body.get('questionId', ''), float(body.get('score') or 0))
    return {'ok': True, 'data': payload}


@app.get('/ai-readiness')
async def ai_readiness_get(assessmentId: str | None = Query(default=None)):
    return await load_module('ai-readiness', assessmentId)


@app.post('/ai-readiness')
async def ai_readiness_post(body: dict):
    payload = await save_score('ai-readiness', body.get('assessmentId'), body.get('questionId', ''), float(body.get('score') or 0))
    return {'ok': True, 'data': payload}


@app.get('/ai-use-cases')
async def ai_use_cases_get(assessmentId: str | None = Query(default=None)):
    return await load_module('ai-use-cases', assessmentId)


@app.post('/ai-use-cases')
async def ai_use_cases_post(body: dict):
    payload = await save_score('ai-use-cases', body.get('assessmentId'), body.get('questionId', ''), float(body.get('score') or 0))
    return {'ok': True, 'data': payload}


@app.get('/operational-audit')
async def operational_audit_get(assessmentId: str | None = Query(default=None)):
    return await load_operational_audit(assessmentId)


@app.post('/operational-audit')
async def operational_audit_post(body: dict):
    action = body.get('action')
    if action == 'update-question':
        payload = await update_question(body.get('assessmentId'), body.get('questionId', ''), float(body.get('score') or 0), body.get('notes', ''), body.get('evidenceSummary', ''))
    elif action == 'bulk-score':
        payload = await bulk_score(body.get('assessmentId'), body.get('updates') or [])
    elif action == 'update-metric':
        payload = await update_metric(body.get('assessmentId'), body.get('metricId', ''), body.get('workflowId'), **body)
    else:
        raise RuntimeError('Unsupported Operational Audit action.')
    return {'ok': True, 'data': payload}


@app.get('/revenue-leakage')
async def revenue_leakage_get(assessmentId: str | None = Query(default=None)):
    return await load_revenue_leakage(assessmentId)


@app.post('/revenue-leakage')
async def revenue_leakage_post(body: dict):
    payload = await update_revenue_leakage(body.get('assessmentId'), body)
    return {'ok': True, 'data': payload}
