from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from ..libraries import load_generic_library
from ..shared import MODULE_IDS, maturity_from_percent, resolve_assessment_id, round2
from ..supabase_rest import client

MODULE_META = {
    'data-foundation': ('DATA', 'Data Foundation'),
    'ai-readiness': ('AIR', 'AI Readiness'),
    'ai-use-cases': ('AIUC', 'AI Use Cases'),
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _score_band(score: float) -> str:
    if score <= 2:
        return '1-2'
    if score <= 3:
        return '3'
    return '4-5'


def _build_findings_preview(library: Dict[str, Any], response_map: Dict[str, Any]) -> List[Dict[str, Any]]:
    findings = []
    findings_lib = library.get('findings', []) or []
    for question in library.get('questions', []) or []:
        score = float((response_map.get(question['question_id']) or {}).get('score_1_to_5') or 0)
        if score <= 0 or score >= 4:
            continue
        band = _score_band(score)
        finding = next(
            (
                row for row in findings_lib
                if (row.get('question_id') == question['question_id'] or row.get('domain_id') == question['domain_id'])
                and row.get('score_band') == band
            ),
            None,
        )
        findings.append({
            'finding_title': (finding or {}).get('finding_title') or f"{question['workflow_name']} requires attention",
            'severity_band': 'CRITICAL' if band == '1-2' else 'DEVELOPING',
            'domain_id': question['domain_id'],
            'is_priority': band == '1-2',
        })
    return findings[:12]


def build_payload(module_path: str, assessment_id: str, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
    module_code, _ = MODULE_META[module_path]
    library = load_generic_library(module_code)
    questions = library.get('questions', []) or []
    domains = library.get('domains', []) or []
    response_map = {row['question_id']: row for row in responses}
    domain_scores = []
    completed_domains = 0
    score_pcts = []

    for domain in domains:
        domain_questions = [q for q in questions if q.get('domain_id') == domain.get('domain_id')]
        answered_rows = [response_map[q['question_id']] for q in domain_questions if q['question_id'] in response_map and response_map[q['question_id']].get('score_1_to_5') is not None]
        answered = len(answered_rows)
        total = len(domain_questions)
        raw_total = sum(float(row.get('score_1_to_5') or 0) for row in answered_rows)
        pct = round2((raw_total / (total * 5)) * 100) if total else 0.0
        is_complete = total > 0 and answered == total
        if is_complete:
            completed_domains += 1
        if pct:
            score_pcts.append(pct)
        domain_scores.append({
            'domain_id': domain['domain_id'],
            'score_pct': pct,
            'maturity_band': maturity_from_percent(pct),
            'questions_answered': answered,
            'questions_total': total,
            'is_complete': is_complete,
        })

    overall_pct = round2(sum(score_pcts) / len(score_pcts)) if score_pcts else 0.0
    return {
        'assessmentId': assessment_id,
        'questions': questions,
        'responses': responses,
        'moduleScore': {
            'score_pct': overall_pct,
            'maturity_band': maturity_from_percent(overall_pct),
            'is_complete': completed_domains == len(domains) if domains else False,
            'domains_completed': completed_domains,
            'domains_total': len(domains),
        },
        'domainScores': domain_scores,
        'findingsPreview': _build_findings_preview(library, response_map),
    }


async def load_module(module_path: str, assessment_id: str | None) -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    module_code, _ = MODULE_META[module_path]
    responses = await client.select('question_responses', filters={'assessment_id': f'eq.{resolved}', 'module_id': f'eq.{MODULE_IDS[module_code]}'}, order='question_id.asc')
    return build_payload(module_path, resolved, responses)


async def save_score(module_path: str, assessment_id: str | None, question_id: str, score: float) -> Dict[str, Any]:
    resolved = await resolve_assessment_id(assessment_id)
    module_code, _ = MODULE_META[module_path]
    library = load_generic_library(module_code)
    question = next((row for row in library.get('questions', []) if row.get('question_id') == question_id), None)
    if not question:
        raise RuntimeError(f'Question {question_id} was not found.')
    payload = {
        'response_id': f"{resolved}-{MODULE_IDS[module_code]}-{question_id}",
        'assessment_id': resolved,
        'module_id': MODULE_IDS[module_code],
        'domain_id': question.get('domain_id', ''),
        'workflow_id': question.get('workflow_id', ''),
        'question_id': question_id,
        'score_1_to_5': int(score),
        'score': int(score),
        'notes': '',
        'evidence_summary': '',
        'assessor_confidence': 'WORKING',
        'is_complete': True,
        'scored_at': _now_iso(),
        'updated_at': _now_iso(),
    }
    await client.upsert('question_responses', payload, on_conflict='assessment_id,module_id,question_id')
    responses = await client.select('question_responses', filters={'assessment_id': f'eq.{resolved}', 'module_id': f'eq.{MODULE_IDS[module_code]}'}, order='question_id.asc')
    return build_payload(module_path, resolved, responses)
