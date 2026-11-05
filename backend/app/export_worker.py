"""Export immutable approved content and synthetic parity cases for the edge runtime."""
import argparse
import base64
import hashlib
import hmac
import json
import random
from pathlib import Path
from types import SimpleNamespace

from pydantic import BaseModel
from app.schemas import contracts
from app.subjects.registry import PACKS, CROSS_SUBJECT_RELATIONSHIPS
from app.subjects.base_pack import Item
from app.knowledge_graph.graph_engine import validate_graph, validate_cross_subject
from app.diagnostics.evidence_analyzer import grade
from app.diagnostics.engine import diagnose, ENGINE_VERSION
from app.diagnostics.verification_engine import select_verification, update_support
from app.api.curriculum_routes import curriculum_status, ExamDraftRequest, AIExamDraftRequest
from app.services.curriculum_exam import indicator_catalog, generate_exam
from app.services.qwen_exam import OBEC_CURRICULUM, OBEC_INDICATORS, Questions
from app.api.research_routes import EvaluationInput
from app.analytics.evaluation_metrics import descriptive, reliability, agreement


def export(target: Path):
    target.mkdir(parents=True, exist_ok=True)
    schemas = {name: value.model_json_schema() for name, value in vars(contracts).items()
               if isinstance(value, type) and issubclass(value, BaseModel) and value is not BaseModel}
    schemas.update(Item=Item.model_json_schema(), Questions=Questions.model_json_schema(), EvaluationInput=EvaluationInput.model_json_schema(), ExamDraftRequest=ExamDraftRequest.model_json_schema(),
                   AIExamDraftRequest=AIExamDraftRequest.model_json_schema())
    exceptions = {chr(i): chr(i).casefold() for i in range(0x110000) if chr(i).casefold() != chr(i).lower()}
    content = {'packs': {key: pack.model_dump() for key, pack in PACKS.items()},
        'crossRelationships': [edge.model_dump() for edge in CROSS_SUBJECT_RELATIONSHIPS],
        'graphValidation': {key: validate_graph(pack) for key, pack in PACKS.items()},
        'crossValidation': validate_cross_subject(PACKS, CROSS_SUBJECT_RELATIONSHIPS),
        'curriculumStatus': curriculum_status(SimpleNamespace(role='teacher')),
        'indicators': indicator_catalog(), 'obecCurriculum': OBEC_CURRICULUM, 'obecIndicators': OBEC_INDICATORS,
        'schemas': schemas, 'engineVersion': ENGINE_VERSION,
        'casefoldExceptions': exceptions, 'whitespace': ''.join(chr(i) for i in range(0x110000) if chr(i).isspace())}
    cases = []
    grading = []
    for key, pack in PACKS.items():
        for item in pack.items:
            for answer, reasoning in [(item.answers[0], ' '.join(g[0] for g in item.rubric.required_groups)),
                                      ('synthetic incorrect answer', ' '.join(item.rubric.misconception_terms)),
                                      (item.answers[0], 'synthetic unrelated reasoning')]:
                correct, rubric = grade(item, answer, reasoning)
                grading.append({'pack': key, 'item': item.id, 'answer': answer, 'reasoning': reasoning,
                                'expected': [correct, rubric]})
        for seed in range(12):
            rng = random.Random(seed)
            responses = []
            for index, item in enumerate(i for i in pack.items if i.stage == 'pre'):
                if rng.random() < seed / 14:
                    continue
                answer = item.answers[0] if rng.random() < .5 else 'synthetic incorrect answer'
                reasoning = (' '.join(group[0] for group in item.rubric.required_groups) if rng.random() < .5
                             else ' '.join(item.rubric.misconception_terms))
                correct, rubric = grade(item, answer, reasoning)
                responses.append(SimpleNamespace(id=f'synthetic-{key}-{seed}-{index}', item_id=item.id,
                    correct=correct, rubric=rubric, confidence=rng.randint(1, 5)))
            evidence, hypotheses = diagnose(pack, responses)
            selected = select_verification(pack, hypotheses, {r.item_id for r in responses})
            verification = None
            if selected:
                item, reason = selected
                correct, rubric = grade(item, item.answers[0], ' '.join(group[0] for group in item.rubric.required_groups))
                observation = SimpleNamespace(id='synthetic-verification', correct=correct, rubric=rubric)
                verification = {'item': item.id, 'reason': reason, 'response': vars(observation),
                    'updates': update_support(hypotheses, item, observation)}
            cases.append({'pack': key, 'responses': [vars(r) for r in responses],
                'expected': [evidence, hypotheses], 'verification': verification})
    fixture = {'purpose': 'Synthetic software parity tests only; not learning or research results.',
        'grading': grading, 'diagnostics': cases,
        'hmac': {'password': 'รหัสผ่านทดสอบ' * 10, 'pepper': 'synthetic-test-only-pepper-32-characters'}}
    fixture['hmac']['expected'] = base64.b64encode(hmac.digest(fixture['hmac']['pepper'].encode(),
        fixture['hmac']['password'].encode(), hashlib.sha384)).decode()
    fixture['metrics'] = []
    fixture['exams'] = [{'indicator': indicator, 'seed': seed, 'count': count, 'expected': generate_exam(indicator, count, seed)}
        for indicator in ('rational', 'ratio', 'equation') for seed in (0, 1, 42, 2**32-1) for count in (1, 5, 10, 20)]
    for seed in range(12):
        rng = random.Random(seed)
        values = [rng.random() for _ in range(seed)]
        matrix = [[rng.randint(0, 1) for _ in range(5)] for _ in range(seed)]
        labels = [rng.choice(['gap', 'aligned', 'uncertain']) for _ in range(seed + 1)]
        predictions = [rng.choice(['gap', 'aligned', 'uncertain']) for _ in labels]
        fixture['metrics'].append({'values': values, 'matrix': matrix, 'labels': labels, 'predictions': predictions,
            'descriptive': descriptive(values), 'reliability': reliability(matrix), 'agreement': agreement(labels, predictions)})
    for name, data in [('content.json', content), ('parity.json', fixture)]:
        (target/name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    export(parser.parse_args().out)

