from __future__ import annotations

import copy
from typing import Any, Dict, List

from ..libraries import load_leakage_benchmarks, load_leakage_model
from ..shared import mean, round2, maturity_from_percent, resolve_assessment_id, get_module_runtime, update_module_runtime


def parse_default_value(raw: str | None) -> float:
    if raw is None:
        return 0.0
    value = str(raw).strip()
    if not value:
        return 0.0
    lowered = value.lower()
    if lowered.startswith('no fixed') or lowered.startswith('no universal'):
        return 0.0
    if '-' in value:
        nums = []
        for part in value.split('-'):
            try:
                nums.append(float(part.strip().replace('%', '').replace('+', '')))
            except ValueError:
                pass
        return sum(nums) / len(nums) if nums else 0.0
    try:
        return float(value.replace('%', '').replace('+', '').strip())
    except ValueError:
        return 0.0


def available_profiles() -> List[str]:
    rows = load_leakage_benchmarks()
    return sorted({row.get('Profile', '') for row in rows if row.get('Profile')})


def create_blank_state() -> Dict[str, Any]:
    model = load_leakage_model()
    cores: Dict[str, Any] = {}
    for core in model['cores']:
        support: Dict[str, float] = {}
        if core['name'] == 'Qualified Lead Volume Leakage':
            support = {'Target Qualified Lead-to-Win %': 0.0, 'Target Average Deal Size': 0.0}
        elif core['name'] == 'Qualified Lead-to-Win Conversion Leakage':
            support = {'Actual Qualified Leads': 0.0, 'Target Average Deal Size': 0.0}
        elif core['name'] == 'Average Deal Size Leakage':
            support = {'Actual Qualified Leads': 0.0, 'Actual Qualified Lead-to-Win %': 0.0}
        cores[core['name']] = {
            'actual': 0.0,
            'benchmark': 0.0,
            'support': support,
            'drivers': {driver['name']: {'actual': 0.0, 'benchmark': 0.0} for driver in core['drivers']},
        }
    return {
        'profile': {
            'Client Name': 'Blank Template',
            'Industry': '',
            'Company Size': '',
            'Business Model': '',
            'Revenue Model': '',
            'Assessment Period': '',
            'Currency': 'ZAR',
            'Notes': '',
        },
        'cores': cores,
        'benchmarkProfile': '',
    }


def profile_defaults(profile_name: str) -> Dict[str, Dict[str, Dict[str, Any]]]:
    rows = [row for row in load_leakage_benchmarks() if row.get('Profile') == profile_name]
    metrics: Dict[str, Dict[str, Any]] = {}
    drivers: Dict[str, Dict[str, Any]] = {}
    metric_names = {
        'Qualified Lead Volume Leakage',
        'Qualified Lead-to-Win Conversion Leakage',
        'Average Deal Size Leakage',
        'Pricing / Discount Leakage tolerance',
        'Unbilled / Uninvoiced Revenue Leakage tolerance',
        'Billing Error / Credit Note Leakage tolerance',
        'Revenue Churn Leakage',
        'Expansion Revenue Gap',
        'Bad Debt / Collections Leakage tolerance',
    }
    for row in rows:
        name = row.get('Metric/Driver', '')
        payload = {
            'value': parse_default_value(row.get('Default Value')),
            'unit': row.get('Unit', ''),
            'type': row.get('Type', ''),
            'confidence': row.get('Confidence', ''),
            'notes': row.get('Notes', ''),
            'source': row.get('Source', ''),
        }
        if name in metric_names:
            metrics[name] = payload
        else:
            drivers[name] = payload
    return {'metrics': metrics, 'drivers': drivers}


def apply_profile(state: Dict[str, Any], profile_name: str) -> Dict[str, Any]:
    next_state = copy.deepcopy(state)
    defaults = profile_defaults(profile_name)
    next_state['benchmarkProfile'] = profile_name
    next_state.setdefault('profile', {})['Benchmark Profile'] = profile_name
    map_key = {
        'Qualified Lead Volume Leakage': 'Qualified Lead Volume Leakage',
        'Qualified Lead-to-Win Conversion Leakage': 'Qualified Lead-to-Win Conversion Leakage',
        'Average Deal Size Leakage': 'Average Deal Size Leakage',
        'Pricing / Discount Leakage': 'Pricing / Discount Leakage tolerance',
        'Unbilled / Uninvoiced Revenue Leakage': 'Unbilled / Uninvoiced Revenue Leakage tolerance',
        'Billing Error / Credit Note Leakage': 'Billing Error / Credit Note Leakage tolerance',
        'Revenue Churn Leakage': 'Revenue Churn Leakage',
        'Expansion Revenue Gap': 'Expansion Revenue Gap',
        'Bad Debt / Collections Leakage': 'Bad Debt / Collections Leakage tolerance',
    }
    for core in load_leakage_model()['cores']:
        name = core['name']
        core_state = next_state['cores'][name]
        metric_key = map_key[name]
        if metric_key in defaults['metrics']:
            value = defaults['metrics'][metric_key]['value']
            core_state['benchmark'] = value / 100.0 if name == 'Qualified Lead-to-Win Conversion Leakage' else value
        if name == 'Qualified Lead Volume Leakage':
            if 'Qualified Lead-to-Win Conversion Leakage' in defaults['metrics']:
                core_state['support']['Target Qualified Lead-to-Win %'] = defaults['metrics']['Qualified Lead-to-Win Conversion Leakage']['value'] / 100.0
            if 'Average Deal Size Leakage' in defaults['metrics']:
                core_state['support']['Target Average Deal Size'] = defaults['metrics']['Average Deal Size Leakage']['value']
        elif name == 'Qualified Lead-to-Win Conversion Leakage' and 'Average Deal Size Leakage' in defaults['metrics']:
            core_state['support']['Target Average Deal Size'] = defaults['metrics']['Average Deal Size Leakage']['value']
        for driver in core['drivers']:
            if driver['name'] in defaults['drivers']:
                core_state['drivers'][driver['name']]['benchmark'] = defaults['drivers'][driver['name']]['value']
    return next_state


def within_benchmark(actual: float, benchmark: float, direction: str) -> bool:
    return actual >= benchmark if direction == 'Higher is better' else actual <= benchmark


def driver_score(drivers: Dict[str, Dict[str, float]], driver_defs: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows = []
    for driver in driver_defs:
        values = drivers.get(driver['name'], {'actual': 0.0, 'benchmark': 0.0})
        actual = float(values.get('actual', 0.0) or 0.0)
        benchmark = float(values.get('benchmark', 0.0) or 0.0)
        ok = within_benchmark(actual, benchmark, driver['direction'])
        rows.append({'name': driver['name'], 'direction': driver['direction'], 'actual': actual, 'benchmark': benchmark, 'within': ok})
    within = sum(1 for row in rows if row['within'])
    return {'score': (within / len(rows) * 100.0) if rows else 0.0, 'within': within, 'total': len(rows), 'rows': rows}


def calc_leakage(core_name: str, core_data: Dict[str, Any]) -> float:
    actual = float(core_data.get('actual', 0.0) or 0.0)
    benchmark = float(core_data.get('benchmark', 0.0) or 0.0)
    support = core_data.get('support', {}) or {}
    if core_name == 'Qualified Lead Volume Leakage':
        return max(0.0, (benchmark - actual) * float(support.get('Target Qualified Lead-to-Win %', 0.0) or 0.0) * float(support.get('Target Average Deal Size', 0.0) or 0.0))
    if core_name == 'Qualified Lead-to-Win Conversion Leakage':
        return max(0.0, float(support.get('Actual Qualified Leads', 0.0) or 0.0) * (benchmark - actual) * float(support.get('Target Average Deal Size', 0.0) or 0.0))
    if core_name == 'Average Deal Size Leakage':
        return max(0.0, float(support.get('Actual Qualified Leads', 0.0) or 0.0) * float(support.get('Actual Qualified Lead-to-Win %', 0.0) or 0.0) * (benchmark - actual))
    if core_name in {'Pricing / Discount Leakage', 'Unbilled / Uninvoiced Revenue Leakage', 'Billing Error / Credit Note Leakage', 'Revenue Churn Leakage', 'Bad Debt / Collections Leakage'}:
        return max(0.0, actual - benchmark)
    if core_name == 'Expansion Revenue Gap':
        return max(0.0, benchmark - actual)
    return 0.0


def severity_from_leakage(value: float) -> str:
    if value >= 1_000_000:
        return 'High'
    if value >= 250_000:
        return 'Medium'
    if value > 0:
        return 'Low'
    return 'None'


def compute_leakage(state: Dict[str, Any]) -> Dict[str, Any]:
    model = load_leakage_model()
    core_rows = []
    total = 0.0
    for core in model['cores']:
        core_state = state['cores'].get(core['name']) or {'actual': 0, 'benchmark': 0, 'support': {}, 'drivers': {}}
        leakage = calc_leakage(core['name'], core_state)
        driver = driver_score(core_state.get('drivers', {}), core['drivers'])
        severity = severity_from_leakage(leakage)
        status = 'Healthy' if leakage == 0 else 'Adverse' if severity in {'High', 'Medium'} else 'Watch'
        core_rows.append({
            'name': core['name'],
            'category': core['category'],
            'actual_label': core['actual_label'],
            'benchmark_label': core['benchmark_label'],
            'actual': float(core_state.get('actual', 0.0) or 0.0),
            'benchmark': float(core_state.get('benchmark', 0.0) or 0.0),
            'leakage': round2(leakage),
            'severity': severity,
            'status': status,
            'driver_score': round2(driver['score']),
            'drivers_within': driver['within'],
            'drivers_total': driver['total'],
            'driver_rows': driver['rows'],
            'formula': core['leakage_formula_label'],
            'advisory': core['advisory'],
            'support': core_state.get('support', {}),
        })
        total += leakage
    top3 = sorted(core_rows, key=lambda row: row['leakage'], reverse=True)[:3]
    avg_driver = round2(mean([row['driver_score'] for row in core_rows])) if core_rows else 0.0
    cores = state.get('cores', {})
    ql = float((cores.get('Qualified Lead Volume Leakage') or {}).get('actual', 0) or 0)
    ql_target = float((cores.get('Qualified Lead Volume Leakage') or {}).get('benchmark', 0) or 0)
    conv = float((cores.get('Qualified Lead-to-Win Conversion Leakage') or {}).get('actual', 0) or 0)
    conv_target = float((cores.get('Qualified Lead-to-Win Conversion Leakage') or {}).get('benchmark', 0) or 0)
    ads = float((cores.get('Average Deal Size Leakage') or {}).get('actual', 0) or 0)
    ads_target = float((cores.get('Average Deal Size Leakage') or {}).get('benchmark', 0) or 0)
    revenue_churn = float((cores.get('Revenue Churn Leakage') or {}).get('actual', 0) or 0)
    expansion = float((cores.get('Expansion Revenue Gap') or {}).get('actual', 0) or 0)
    expansion_target = float((cores.get('Expansion Revenue Gap') or {}).get('benchmark', 0) or 0)
    unbilled = float((cores.get('Unbilled / Uninvoiced Revenue Leakage') or {}).get('actual', 0) or 0)
    billing_errors = float((cores.get('Billing Error / Credit Note Leakage') or {}).get('actual', 0) or 0)
    bad_debt = float((cores.get('Bad Debt / Collections Leakage') or {}).get('actual', 0) or 0)
    monthly_revenue_proxy = max(1.0, (ads * max(1.0, ql * max(conv, 0.01))) / 3.0)
    dso_proxy = round2(((bad_debt + unbilled) / monthly_revenue_proxy) * 30.0)
    return {
        'core_rows': core_rows,
        'total_leakage': round2(total),
        'headline': {
            'total_revenue_leakage': round2(total),
            'revenue_gap': round2(total),
            'driver_target_achievement_pct': avg_driver,
            'top_3_leakage_areas': [row['name'] for row in top3],
        },
        'commercial': {
            'qualified_leads': ql,
            'qualified_leads_target': ql_target,
            'qualified_lead_to_win_pct': conv,
            'qualified_lead_to_win_pct_target': conv_target,
            'average_deal_size': ads,
            'average_deal_size_target': ads_target,
            'revenue_churn': revenue_churn,
            'expansion_revenue': expansion,
            'expansion_revenue_target': expansion_target,
        },
        'operational': {
            'unbilled_revenue': unbilled,
            'billing_error_credit_note_value': billing_errors,
            'bad_debt_collections_leakage': bad_debt,
            'dso_proxy_days': dso_proxy,
        },
    }


def build_module_score(summary: Dict[str, Any]) -> Dict[str, Any]:
    rows = summary.get('core_rows', [])
    overall_pct = round2(mean([float(row.get('driver_score', 0.0) or 0.0) for row in rows])) if rows else 0.0
    return {
        'score_pct': overall_pct,
        'maturity_band': maturity_from_percent(overall_pct),
        'domains_completed': len(rows),
        'domains_total': len(rows),
        'critical_exposures': sum(1 for row in rows if row.get('severity') in {'High', 'Medium'}),
        'avg_driver_score': summary.get('headline', {}).get('driver_target_achievement_pct', 0),
        'total_leakage': summary.get('total_leakage', 0),
    }


def build_findings(summary: Dict[str, Any]) -> List[Dict[str, Any]]:
    findings = []
    for idx, core in enumerate(summary.get('core_rows', []), start=1):
        if float(core.get('leakage', 0.0) or 0.0) <= 0:
            continue
        severity = 'CRITICAL' if core.get('severity') in {'High', 'Medium'} else 'DEVELOPING'
        weak_drivers = [row['name'] for row in core.get('driver_rows', []) if not row.get('within')][:5]
        findings.append({
            'finding_instance_id': f"LEAK::{idx}",
            'severity_band': severity,
            'finding_title': f"{core['name']} exposure detected",
            'finding_narrative': f"Estimated exposure is R {int(core['leakage']):,} and driver achievement is {round(core['driver_score'])}%.",
            'is_priority': severity == 'CRITICAL',
            'likely_root_cause': ', '.join(weak_drivers),
        })
    return findings


def build_roadmap(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    roadmap = []
    for idx, finding in enumerate(findings, start=1):
        phase_code = 'P1' if finding['severity_band'] == 'CRITICAL' else 'P2'
        roadmap.append({
            'roadmap_instance_id': f"LEAK::ROAD::{idx}",
            'phase_code': phase_code,
            'phase_name': 'Stabilise and Protect' if phase_code == 'P1' else 'Standardise and Strengthen',
            'initiative_title': finding['finding_title'],
            'initiative_text': finding['finding_narrative'],
            'owner_role': 'Commercial Lead',
            'priority_rank': idx,
            'status': 'NOT_STARTED',
        })
    return roadmap


async def get_state(assessment_id: str) -> Dict[str, Any]:
    row = await get_module_runtime(assessment_id, 'LEAK')
    runtime_state = (row or {}).get('runtime_state') or {}
    if runtime_state:
        return runtime_state
    blank = create_blank_state()
    await update_module_runtime(assessment_id, 'LEAK', blank, summary_payload={'engine': 'python'})
    return blank


async def save_state(assessment_id: str, state: Dict[str, Any]) -> None:
    summary = compute_leakage(state)
    await update_module_runtime(assessment_id, 'LEAK', state, summary_payload={'headline': summary.get('headline', {})}, completion_pct=25)


async def load_revenue_leakage(assessment_id: str | None) -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    state = await get_state(resolved)
    summary = compute_leakage(state)
    findings = build_findings(summary)
    roadmap = build_roadmap(findings)
    return {
        'assessmentId': resolved,
        'model': load_leakage_model(),
        'benchmarkProfiles': available_profiles(),
        'state': state,
        'summary': summary,
        'moduleScore': build_module_score(summary),
        'findings': findings,
        'roadmap': roadmap,
    }


async def update_revenue_leakage(assessment_id: str | None, body: Dict[str, Any]) -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    current = await get_state(resolved)
    next_state = copy.deepcopy(current)
    action = body.get('action')
    if action == 'set-benchmark-profile':
        next_state = apply_profile(next_state, body['profileName'])
    elif action == 'update-profile':
        next_state.setdefault('profile', {}).update(body.get('profile') or {})
    elif action == 'update-core':
        core = next_state['cores'].get(body['coreName'])
        if not core:
            raise RuntimeError(f"Core {body['coreName']} not found.")
        core[body['field']] = float(body.get('value') or 0)
    elif action == 'update-support':
        core = next_state['cores'].get(body['coreName'])
        if not core:
            raise RuntimeError(f"Core {body['coreName']} not found.")
        core.setdefault('support', {})[body['supportKey']] = float(body.get('value') or 0)
    elif action == 'update-driver':
        core = next_state['cores'].get(body['coreName'])
        if not core:
            raise RuntimeError(f"Core {body['coreName']} not found.")
        driver = core.setdefault('drivers', {}).setdefault(body['driverName'], {'actual': 0.0, 'benchmark': 0.0})
        driver[body['field']] = float(body.get('value') or 0)
    else:
        raise RuntimeError('Unsupported Revenue Leakage action.')
    await save_state(resolved, next_state)
    return await load_revenue_leakage(resolved)
