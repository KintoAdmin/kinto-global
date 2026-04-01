from __future__ import annotations

from typing import Any, Dict, List, Optional

from .supabase_rest import client

MODULE_IDS = {
    'OPS': 'MOD-OPS',
    'LEAK': 'MOD-LEAK',
    'DATA': 'MOD-DATA',
    'AIR': 'MOD-AIR',
    'AIUC': 'MOD-AIUC',
}


def round2(value: float) -> float:
    return round(float(value or 0), 2)


def mean(values: List[float]) -> float:
    clean = [float(v) for v in values if v is not None]
    return sum(clean) / len(clean) if clean else 0.0


def maturity_from_percent(pct: float) -> str:
    if pct >= 80:
        return 'STRONG'
    if pct >= 60:
        return 'MANAGED'
    if pct >= 40:
        return 'DEVELOPING'
    if pct > 0:
        return 'WEAK'
    return 'INCOMPLETE'


def maturity_label(pct: float) -> str:
    if pct >= 80:
        return 'Strong / Managed'
    if pct >= 60:
        return 'Managed'
    if pct >= 40:
        return 'Developing'
    if pct > 0:
        return 'Critical / Weak'
    return 'Not scored'


async def resolve_assessment_id(assessment_id: Optional[str]) -> str:
    if assessment_id:
        row = await client.select('assessments', filters={'assessment_id': f'eq.{assessment_id}'}, maybe_single=True)
        if not row:
            raise RuntimeError(f'Assessment {assessment_id} was not found.')
        return assessment_id
    latest = await client.select('assessments', order='assessment_date.desc', limit=1, maybe_single=True)
    if not latest:
        raise RuntimeError('No assessment found. Create a client and assessment first.')
    return latest['assessment_id']


async def get_module_runtime(assessment_id: str, module_code: str):
    return await client.select('assessment_modules', filters={'assessment_id': f'eq.{assessment_id}', 'module_id': f'eq.{MODULE_IDS[module_code]}'}, maybe_single=True)


async def update_module_runtime(assessment_id: str, module_code: str, runtime_state: Dict[str, Any], summary_payload: Optional[Dict[str, Any]] = None, completion_pct: Optional[float] = None) -> None:
    payload: Dict[str, Any] = {'runtime_state': runtime_state}
    if summary_payload is not None:
        payload['summary_payload'] = summary_payload
    if completion_pct is not None:
        payload['completion_pct'] = completion_pct
        payload['module_status'] = 'COMPLETED' if completion_pct >= 100 else 'IN_PROGRESS'
    await client.update('assessment_modules', payload, filters={'assessment_id': f'eq.{assessment_id}', 'module_id': f'eq.{MODULE_IDS[module_code]}'})
