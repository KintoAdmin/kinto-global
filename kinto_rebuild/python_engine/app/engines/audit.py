from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List

from ..libraries import load_audit_bundle
from ..shared import MODULE_IDS, maturity_label, resolve_assessment_id, round2, mean
from ..supabase_rest import client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _score_pct(score: float) -> float:
    return round2((float(score or 0) / 5.0) * 100.0)


def _band(score: float) -> str:
    if score <= 0:
        return 'Not scored'
    if score <= 2:
        return 'Critical / Weak'
    if score == 3:
        return 'Developing'
    return 'Strong / Managed'


def _band_key(score: float) -> str:
    if score <= 0:
        return ''
    if score <= 2:
        return '1-2'
    if score == 3:
        return '3'
    return '4-5'


def _metric_snapshot(metric_def: Dict[str, Any] | None, captures: List[Dict[str, Any]]) -> Dict[str, Any] | None:
    if not metric_def:
        return None
    workflow_id = metric_def.get('workflow_id', '')
    metric_id = metric_def.get('metric_id', '')
    capture = next((row for row in captures if row.get('metric_id') == metric_id and str(row.get('workflow_id') or '') == str(workflow_id or '')), None)
    return {
        'metric_id': metric_id,
        'metric_name': metric_def.get('metric_name', ''),
        'baseline_value': (capture or {}).get('baseline_value', ''),
        'current_value': (capture or {}).get('current_value', ''),
        'target_value': (capture or {}).get('target_value', ''),
        'rag_status': (capture or {}).get('rag_status', ''),
        'workflow_id': workflow_id,
        'unit': metric_def.get('unit', ''),
    }


def build_summary(responses: List[Dict[str, Any]], captures: List[Dict[str, Any]]) -> Dict[str, Any]:
    bundle = load_audit_bundle()
    response_map = {row['question_id']: row for row in responses}
    domain_scores: List[Dict[str, Any]] = []
    scored_rows: List[Dict[str, Any]] = []

    for domain in bundle['domains']:
        domain_questions = bundle['questions_by_domain'].get(domain['domain_id'], [])
        scored = []
        for q in domain_questions:
            score = float((response_map.get(q['question_id']) or {}).get('score') or (response_map.get(q['question_id']) or {}).get('score_1_to_5') or 0)
            if score > 0:
                scored.append(score)
                scored_rows.append({'question': q, 'score': score})
        avg_score = round2(mean(scored)) if scored else 0.0
        percentage = _score_pct(avg_score)
        domain_scores.append({
            'domain_id': domain['domain_id'],
            'domain_name': domain['domain_name'],
            'domain_description': domain.get('domain_description', ''),
            'audit_focus': domain.get('audit_focus', ''),
            'answered': len(scored),
            'total': len(domain_questions),
            'avg_score': avg_score,
            'percentage': percentage,
            'maturity': maturity_label(percentage),
            'is_scored': bool(scored),
        })

    surfaced_findings: List[Dict[str, Any]] = []
    priority_findings: List[Dict[str, Any]] = []
    developing_findings: List[Dict[str, Any]] = []
    root_causes: Counter[str] = Counter()

    for row in scored_rows:
        q = row['question']
        score = float(row['score'])
        if score > 3:
            continue
        finding = (q.get('findings_by_band') or {}).get(_band_key(score), {})
        rec = q.get('recommendation') or {}
        action = q.get('action') or {}
        roadmap = q.get('roadmap') or {}
        transformation = q.get('transformation') or {}
        root_cause = finding.get('likely_root_cause') or ''
        if root_cause:
            root_causes[root_cause] += 1
        item = {
            'question_id': q['question_id'],
            'question_text': q['question_text'],
            'domain_name': q.get('domain_name', ''),
            'workflow_name': q.get('workflow_name', ''),
            'step_name': q.get('step_name', ''),
            'score': score,
            'score_pct': _score_pct(score),
            'severity_band': _band(score),
            'finding_id': finding.get('finding_id', ''),
            'finding_title': finding.get('finding_title') or q['question_text'],
            'finding_text': finding.get('finding_text') or q['question_text'],
            'business_impact': finding.get('business_impact') or q.get('customer_impact_if_weak', ''),
            'likely_root_cause': root_cause,
            'evidence_to_validate': finding.get('evidence_to_validate') or q.get('evidence_examples', ''),
            'report_priority': finding.get('report_priority') or q.get('priority_weight', ''),
            'owner_role': roadmap.get('owner_role') or q.get('owner_role', '') or action.get('action_owner', ''),
            'roadmap_phase': roadmap.get('phase_name') or q.get('roadmap_phase') or action.get('phase') or 'Unphased',
            'phase_name': roadmap.get('phase_name') or q.get('roadmap_phase') or action.get('phase') or 'Unphased',
            'phase_number': int(roadmap.get('phase_number') or 99),
            'recommendation': rec,
            'action': action,
            'roadmap': roadmap,
            'transformation': transformation,
            'automation_flag': q.get('automation_flag', 'No'),
            'ai_flag': q.get('ai_flag', 'No'),
            'included_in_roadmap': score <= 2,
            'notes': (response_map.get(q['question_id']) or {}).get('notes', ''),
            'supporting_metric': _metric_snapshot(q.get('primary_metric'), captures),
        }
        surfaced_findings.append(item)
        if score <= 2:
            priority_findings.append(item)
        else:
            developing_findings.append(item)

    surfaced_findings.sort(key=lambda x: (x['score'], x['phase_number'], x['domain_name']))
    priority_findings.sort(key=lambda x: (x['score'], x['phase_number'], x['domain_name']))
    developing_findings.sort(key=lambda x: (x['phase_number'], x['domain_name']))

    roadmap = []
    seen = set()
    for item in priority_findings:
        key = item.get('question_id') or ''
        if key in seen:
            continue
        seen.add(key)
        action = item.get('action') or {}
        rec = item.get('recommendation') or {}
        roadmap_item = item.get('roadmap') or {}
        roadmap.append({
            'roadmap_id': roadmap_item.get('roadmap_id', ''),
            'phase': item.get('phase_name', 'Unphased'),
            'phase_name': item.get('phase_name', 'Unphased'),
            'phase_number': item.get('phase_number', 99),
            'priority': item.get('report_priority', ''),
            'owner': item.get('owner_role', ''),
            'domain_name': item.get('domain_name', ''),
            'workflow_name': item.get('workflow_name', ''),
            'step_name': item.get('step_name', ''),
            'question_text': item.get('question_text', ''),
            'finding_title': item.get('finding_title', ''),
            'severity_band': item.get('severity_band', ''),
            'score': item.get('score', 0),
            'score_pct': item.get('score_pct', 0),
            'action_title': action.get('action_title') or rec.get('recommendation_title') or roadmap_item.get('milestone_name') or item.get('question_text', ''),
            'action_text': action.get('action_text') or rec.get('recommendation_text') or '',
            'recommendation_title': rec.get('recommendation_title', ''),
            'recommendation_text': rec.get('recommendation_text', ''),
            'milestone_name': roadmap_item.get('milestone_name') or action.get('action_title', ''),
            'milestone_description': roadmap_item.get('milestone_description') or action.get('action_text', ''),
            'target_outcome': roadmap_item.get('target_outcome') or rec.get('expected_outcome', ''),
            'kpi_focus': roadmap_item.get('kpi_focus') or '',
            'automation_or_ai_opportunity': roadmap_item.get('automation_or_ai_opportunity') or (item.get('transformation') or {}).get('advanced_intelligence_option', ''),
            'effort_level': action.get('effort_level', ''),
            'dependency': roadmap_item.get('dependency') or action.get('dependency', ''),
            'indicative_timeline': roadmap_item.get('indicative_timeline') or action.get('indicative_timeline', ''),
            'automation_flag': item.get('automation_flag', 'No'),
            'ai_flag': item.get('ai_flag', 'No'),
            'action_deliverable': action.get('action_deliverable', ''),
            'success_measure': action.get('success_measure', ''),
            'transformation_title': (item.get('transformation') or {}).get('transformation_title', ''),
            'transformation_text': (item.get('transformation') or {}).get('transformation_text', ''),
            'supporting_metric': item.get('supporting_metric'),
        })

    overall_avg = round2(mean([float(row['score']) for row in scored_rows])) if scored_rows else 0.0
    overall_pct = _score_pct(overall_avg)
    weakest_domains = sorted([row for row in domain_scores if row['percentage'] > 0], key=lambda x: x['percentage'])[:3]
    strongest_domains = sorted([row for row in domain_scores if row['percentage'] > 0], key=lambda x: x['percentage'], reverse=True)[:3]

    return {
        'overall_avg': overall_avg,
        'overall_percentage': overall_pct,
        'overall_maturity': maturity_label(overall_pct),
        'answered': len(scored_rows),
        'total': len(bundle['questions']),
        'domain_scores': domain_scores,
        'surfaced_findings': surfaced_findings,
        'priority_findings': priority_findings,
        'developing_findings': developing_findings,
        'roadmap': roadmap,
        'weakest_domains': weakest_domains,
        'strongest_domains': strongest_domains,
        'common_root_causes': [text for text, _ in root_causes.most_common(5)],
        'metrics_captured': sum(1 for row in captures if str(row.get('current_value', '')).strip() or str(row.get('target_value', '')).strip() or str(row.get('trend_direction', '')).strip() or str(row.get('rag_status', '')).strip()),
        'metrics_total': len(bundle['metric_map']),
        'automation_ready': sum(1 for row in scored_rows if row['score'] >= 4 and str(row['question'].get('automation_flag', '')).lower() == 'yes'),
        'ai_ready': sum(1 for row in scored_rows if row['score'] >= 4 and str(row['question'].get('ai_flag', '')).lower() == 'yes'),
    }


async def load_operational_audit(assessment_id: str | None) -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    bundle = load_audit_bundle()
    responses = await client.select('question_responses', filters={'assessment_id': f'eq.{resolved}', 'module_id': f'eq.{MODULE_IDS["OPS"]}'})
    captures = await client.select('metric_captures', filters={'assessment_id': f'eq.{resolved}', 'module_id': f'eq.{MODULE_IDS["OPS"]}'})
    summary = build_summary(responses, captures)
    return {
        'assessmentId': resolved,
        'bundle': {
            'domains': bundle['domains'],
            'workflows_by_domain': bundle['workflows_by_domain'],
            'steps_by_workflow': bundle['steps_by_workflow'],
            'questions_by_step': bundle['questions_by_step'],
            'questions': bundle['questions'],
            'roadmap_rows': bundle['roadmap_rows'],
            'primary_metric_by_workflow': bundle['primary_metric_by_workflow'],
            'metric_map': bundle['metric_map'],
        },
        'responses': responses,
        'metricCaptures': captures,
        'summary': summary,
    }


async def update_question(assessment_id: str | None, question_id: str, score: float, notes: str = '', evidence_summary: str = '') -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    bundle = load_audit_bundle()
    question = bundle['question_map'].get(question_id)
    if not question:
        raise RuntimeError(f'Question {question_id} was not found.')
    payload = {
        'response_id': f"{resolved}-{MODULE_IDS['OPS']}-{question_id}",
        'assessment_id': resolved,
        'module_id': MODULE_IDS['OPS'],
        'domain_id': question.get('domain_id', ''),
        'workflow_id': question.get('workflow_id', ''),
        'question_id': question_id,
        'score_1_to_5': int(score),
        'score': int(score),
        'notes': notes,
        'evidence_summary': evidence_summary,
        'assessor_confidence': 'WORKING',
        'is_complete': int(score) > 0,
        'scored_at': _now_iso(),
        'updated_at': _now_iso(),
    }
    await client.upsert('question_responses', payload, on_conflict='assessment_id,module_id,question_id')
    return await load_operational_audit(resolved)


async def bulk_score(assessment_id: str | None, updates: List[Dict[str, Any]]) -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    bundle = load_audit_bundle()
    rows = []
    for item in updates:
        question = bundle['question_map'].get(item.get('questionId', ''))
        if not question:
            continue
        rows.append({
            'response_id': f"{resolved}-{MODULE_IDS['OPS']}-{question['question_id']}",
            'assessment_id': resolved,
            'module_id': MODULE_IDS['OPS'],
            'domain_id': question.get('domain_id', ''),
            'workflow_id': question.get('workflow_id', ''),
            'question_id': question['question_id'],
            'score_1_to_5': int(item.get('score') or 0),
            'score': int(item.get('score') or 0),
            'notes': '',
            'evidence_summary': '',
            'assessor_confidence': 'WORKING',
            'is_complete': int(item.get('score') or 0) > 0,
            'scored_at': _now_iso(),
            'updated_at': _now_iso(),
        })
    if rows:
        await client.upsert('question_responses', rows, on_conflict='assessment_id,module_id,question_id')
    return await load_operational_audit(resolved)


def _calculate_variance(current_value: Any, target_value: Any, unit: str) -> str:
    try:
        current = float(str(current_value).replace(',', '').strip())
        target = float(str(target_value).replace(',', '').strip())
    except Exception:
        return ''
    gap = target - current
    suffix = f' {unit}'.rstrip() if unit and unit != '%' else ''
    if unit == '%':
        return f"{gap:+.1f} pts"
    if abs(gap - int(gap)) < 1e-9:
        return f"{int(gap):+d}{suffix}"
    return f"{gap:+.2f}{suffix}"


async def update_metric(assessment_id: str | None, metric_id: str, workflow_id: str | None, **changes: Any) -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    bundle = load_audit_bundle()
    metric = bundle['metric_map'].get(metric_id)
    if not metric:
        raise RuntimeError(f'Metric {metric_id} was not found.')
    wf = workflow_id or metric.get('workflow_id', '')
    existing = await client.select('metric_captures', filters={'assessment_id': f'eq.{resolved}', 'module_id': f'eq.{MODULE_IDS["OPS"]}', 'metric_id': f'eq.{metric_id}', 'workflow_id': f'eq.{wf}'}, maybe_single=True) or {}
    current_value = changes.get('currentValue', existing.get('current_value', ''))
    target_value = changes.get('targetValue', existing.get('target_value', ''))
    trend_direction = changes.get('trendDirection', existing.get('trend_direction', ''))
    rag_status = changes.get('ragStatus', existing.get('rag_status', ''))
    unit = metric.get('unit', existing.get('unit', ''))
    variance = changes.get('varianceToTarget')
    if variance in (None, ''):
        variance = _calculate_variance(current_value, target_value, str(unit or ''))
    payload = {
        'metric_capture_id': existing.get('metric_capture_id') or f"{resolved}-{MODULE_IDS['OPS']}-{metric_id}-{wf}",
        'assessment_id': resolved,
        'module_id': MODULE_IDS['OPS'],
        'domain_id': metric.get('domain_id', existing.get('domain_id', '')),
        'workflow_id': wf,
        'metric_id': metric_id,
        'metric_name': metric.get('metric_name', existing.get('metric_name', '')),
        'baseline_value': existing.get('baseline_value', ''),
        'baseline_date': existing.get('baseline_date', ''),
        'current_value': current_value,
        'target_value': target_value,
        'variance_to_target': variance,
        'unit': unit,
        'trend_direction': trend_direction,
        'review_frequency': metric.get('frequency', existing.get('review_frequency', '')),
        'owner_role': metric.get('owner_role', existing.get('owner_role', '')),
        'rag_status': rag_status,
        'evidence_strength': existing.get('evidence_strength', 'MEASURED'),
        'source_system': existing.get('source_system', 'Operational Audit Workspace'),
        'notes': changes.get('notes', existing.get('notes', '')),
        'updated_at': _now_iso(),
    }
    await client.upsert('metric_captures', payload, on_conflict='assessment_id,module_id,metric_id,workflow_id')
    return await load_operational_audit(resolved)
