from __future__ import annotations

import csv
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

from .settings import get_settings


@lru_cache(maxsize=1)
def project_root() -> Path:
    return get_settings().project_root


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def _read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


@lru_cache(maxsize=None)
def load_generic_library(module_key: str) -> Dict[str, Any]:
    mapping = {
        'DATA': project_root() / 'src' / 'data' / 'data-foundation' / 'library.json',
        'AIR': project_root() / 'src' / 'data' / 'ai-readiness' / 'library.json',
        'AIUC': project_root() / 'src' / 'data' / 'ai-usecases' / 'library.json',
    }
    return _read_json(mapping[module_key])


@lru_cache(maxsize=1)
def load_leakage_model() -> Dict[str, Any]:
    return _read_json(project_root() / 'data' / 'model.json')


@lru_cache(maxsize=1)
def load_leakage_benchmarks() -> List[Dict[str, str]]:
    return _read_csv(project_root() / 'data' / 'master_benchmark_library_v1.csv')


@lru_cache(maxsize=1)
def load_audit_bundle() -> Dict[str, Any]:
    base = project_root() / 'data' / 'audit'
    domains = _read_csv(base / 'audit_domains.csv')
    workflows = _read_csv(base / 'audit_workflows.csv')
    steps = _read_csv(base / 'audit_steps.csv')
    questions = _read_csv(base / 'audit_questions.csv')
    metrics = _read_csv(base / 'audit_metrics.csv')
    findings = _read_csv(base / 'audit_findings.csv')
    recommendations = _read_csv(base / 'audit_recommendations.csv')
    actions = _read_csv(base / 'audit_actions.csv')
    roadmap = _read_csv(base / 'audit_roadmap.csv')
    transformations = _read_csv(base / 'audit_transformation_register.csv')

    domain_map = {row['domain_id']: row for row in domains}
    workflow_map = {row['workflow_id']: row for row in workflows}
    step_map = {row['step_id']: row for row in steps}
    metric_map = {row['metric_id']: row for row in metrics}
    recommendations_by_id = {row['recommendation_id']: row for row in recommendations}
    actions_by_id = {row['action_id']: row for row in actions}
    roadmap_by_question = {row['question_id']: row for row in roadmap if row.get('question_id')}
    transformation_by_rec = {row['recommendation_id']: row for row in transformations if row.get('recommendation_id')}
    questions_by_step: Dict[str, List[Dict[str, Any]]] = {}
    questions_by_domain: Dict[str, List[Dict[str, Any]]] = {}
    question_map: Dict[str, Dict[str, Any]] = {}
    workflows_by_domain: Dict[str, List[Dict[str, Any]]] = {}
    steps_by_workflow: Dict[str, List[Dict[str, Any]]] = {}
    primary_metric_by_workflow: Dict[str, Dict[str, str]] = {}
    for workflow in workflows:
        workflows_by_domain.setdefault(workflow['domain_id'], []).append(workflow)
    for step in steps:
        steps_by_workflow.setdefault(step['workflow_id'], []).append(step)
    for metric in metrics:
        if metric.get('metric_role', '').lower() == 'primary' and metric.get('workflow_id'):
            primary_metric_by_workflow[metric['workflow_id']] = metric
    findings_lookup: Dict[str, Dict[str, Dict[str, str]]] = {}
    for finding in findings:
        findings_lookup.setdefault(finding['question_id'], {})[finding['score_band']] = finding
    for q in questions:
        enriched = dict(q)
        enriched['domain_name'] = domain_map.get(q['domain_id'], {}).get('domain_name', '')
        enriched['workflow_name'] = workflow_map.get(q['workflow_id'], {}).get('workflow_name', '')
        enriched['step_name'] = step_map.get(q['step_id'], {}).get('step_name', '')
        enriched['domain'] = domain_map.get(q['domain_id'], {})
        enriched['workflow'] = workflow_map.get(q['workflow_id'], {})
        enriched['step'] = step_map.get(q['step_id'], {})
        metric_id = q.get('linked_metric') or ''
        if metric_id and metric_id in metric_map:
            enriched['primary_metric'] = metric_map[metric_id]
        elif q.get('workflow_id') in primary_metric_by_workflow:
            enriched['primary_metric'] = primary_metric_by_workflow[q['workflow_id']]
        enriched['recommendation'] = recommendations_by_id.get(q.get('recommendation_id', ''), {})
        enriched['action'] = actions_by_id.get(q.get('action_id', ''), {})
        enriched['roadmap'] = roadmap_by_question.get(q['question_id'], {})
        enriched['transformation'] = transformation_by_rec.get(q.get('recommendation_id', ''), {})
        enriched['findings_by_band'] = findings_lookup.get(q['question_id'], {})
        question_map[q['question_id']] = enriched
        questions_by_step.setdefault(q['step_id'], []).append(enriched)
        questions_by_domain.setdefault(q['domain_id'], []).append(enriched)
    return {
        'domains': sorted(domains, key=lambda row: int(row.get('display_order') or 0)),
        'workflows_by_domain': {k: sorted(v, key=lambda row: int(row.get('display_order') or 0)) for k, v in workflows_by_domain.items()},
        'steps_by_workflow': {k: sorted(v, key=lambda row: int(row.get('display_order') or 0)) for k, v in steps_by_workflow.items()},
        'questions_by_step': questions_by_step,
        'questions_by_domain': questions_by_domain,
        'questions': list(question_map.values()),
        'question_map': question_map,
        'roadmap_rows': roadmap,
        'primary_metric_by_workflow': primary_metric_by_workflow,
        'metric_map': metric_map,
    }
