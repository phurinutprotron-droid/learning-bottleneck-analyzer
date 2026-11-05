import asyncio
from datetime import timedelta
from sqlalchemy import select, func
from app.tests.conftest import register, staff_headers, baseline
from app.subjects.registry import PACKS
from app.models.entities import Response, AuditLog, AIReview
from app.models.entities import SessionToken, now
from app.core.security import token_hash
from app.services.gemini_provider import validate_suggestion, GeminiProvider
from app.core.config import Settings
from app.schemas.contracts import AISuggestion
import pytest

GOOD_REASONING = 'same numerator denominator ratio rate multiply both sides subtract particle motion energy hot cold transfer conserv'


def test_expired_session_is_rejected(client, db_factory):
    headers, student_id = register(client)
    with db_factory() as db:
        token = headers['Authorization'].removeprefix('Bearer ')
        db.get(SessionToken, token_hash(token)).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get(f'/api/students/{student_id}', headers=headers).status_code == 401


def test_coding_baseline_enters_existing_diagnostic_flow(client):
    headers, student_id = register(client)
    subjects = client.get('/api/subjects', headers=headers).json()
    assert next(pack for pack in subjects if pack['id'] == 'coding')['baseline_item_count'] == 4
    attempt = baseline(client, headers, student_id, 'coding')
    result = client.post(f'/api/assessments/{attempt["id"]}/diagnostics', headers=headers)
    assert result.status_code == 201
    assert client.get('/api/curriculum/status', headers=headers).status_code == 403
    assert client.get('/api/curriculum/status', headers=staff_headers(client)).json()['generation_ready'] is True


def test_auth_roles_and_ownership(client):
    assert client.get('/api/students').status_code == 401
    h, sid = register(client)
    other, _ = register(client, 'learner_two')
    assert client.get('/api/students', headers=h).status_code == 403
    assert client.get(f'/api/students/{sid}', headers=other).status_code == 403
    rh = staff_headers(client, 'researcher')
    assert client.get(f'/api/students/{sid}', headers=rh).status_code == 403
    assert client.get('/api/research/summary', headers=rh).status_code == 200
    assert client.get('/api/research/summary', headers=h).status_code == 403
    assert client.post('/api/auth/register', json={'handle': 'hacker', 'password': 'test-password-123', 'role': 'teacher'}).status_code == 422
    assert client.post('/api/auth/login', json={'handle': 'learner_one', 'password': 'wrong-password'}).status_code == 401
    assert client.post('/api/auth/logout', headers=h).status_code == 204
    assert client.get('/api/auth/me', headers=h).status_code == 401


def test_consent_and_immutable_responses(client, db_factory):
    h, sid = register(client)
    assert client.post(f'/api/students/{sid}/assessments', headers=h, json={'subject_id': 'science'}).status_code == 409
    client.post(f'/api/students/{sid}/consent', headers=h, json={'granted': True})
    a = client.post(f'/api/students/{sid}/assessments', headers=h, json={'subject_id': 'science'}).json()
    assert all('answers' not in i and 'rubric' not in i for i in a['items'])
    assert client.post(f'/api/assessments/{a["id"]}/complete', headers=h).status_code == 409
    item = a['items'][0]
    body = {'item_id': item['id'], 'answer': item['options'][0], 'reasoning': 'particle energy motion', 'confidence': 3}
    result = client.post(f'/api/assessments/{a["id"]}/responses', headers=h, json=body)
    assert result.status_code == 201 and 'correct' not in result.json()
    assert client.post(f'/api/assessments/{a["id"]}/responses', headers=h, json=body).status_code == 409
    assert client.post(f'/api/assessments/{a["id"]}/responses', headers=h, json={**body, 'confidence': 6}).status_code == 422
    client.post(f'/api/students/{sid}/consent', headers=h, json={'granted': False})
    assert client.post(f'/api/assessments/{a["id"]}/responses', headers=h, json={**body, 'item_id': a['items'][1]['id']}).status_code == 409
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(Response)) == 1


def test_integrated_learning_flow_and_export(client, db_factory):
    h, sid = register(client)
    th = staff_headers(client)
    a = baseline(client, h, sid)
    result = client.post(f'/api/assessments/{a["id"]}/diagnostics', headers=h)
    assert result.status_code == 201, result.text
    diagnostic = result.json()
    assert diagnostic['engine_version'] == 'rules-v2'
    assert len(diagnostic['evidence']) == 3
    assert any(x['kind'] == 'knowledge_gap' for x in diagnostic['hypotheses'])
    same = client.post(f'/api/assessments/{a["id"]}/diagnostics', headers=h).json()
    assert same['id'] == diagnostic['id']
    v = client.post(f'/api/diagnostics/{diagnostic["id"]}/verification', headers=h).json()
    again = client.post(f'/api/diagnostics/{diagnostic["id"]}/verification', headers=h).json()
    assert again['id'] == v['id']
    va = v['assessment']
    item = PACKS['mathematics'].item(va['items'][0]['id'])
    assert client.post(f'/api/assessments/{va["id"]}/responses', headers=h, json={'item_id': item.id, 'answer': item.answers[0], 'reasoning': GOOD_REASONING, 'confidence': 1}).status_code == 201
    assert client.post(f'/api/assessments/{va["id"]}/complete', headers=h).status_code == 200
    ev = client.post(f'/api/verifications/{v["id"]}/evaluate', headers=h)
    assert ev.status_code == 200, ev.text
    assert any(u['kind'] == 'knowledge_gap' and u['verification_status'] == 'contradicted' for u in ev.json()['updates'])
    assert client.post(f'/api/verifications/{v["id"]}/evaluate', headers=h).json() == ev.json()
    recs = client.get(f'/api/diagnostics/{diagnostic["id"]}/recommendations', headers=th)
    assert recs.status_code == 200
    rec = recs.json()[0]
    ibody = {k: rec[k] for k in ['concept_id', 'activity', 'expected_outcome']}
    ibody.update(student_id=sid, subject_id='mathematics', baseline_assessment_id=a['id'], review_note='Teacher reviewed sample evidence and selected this activity.')
    assert client.post('/api/interventions', headers=h, json=ibody).status_code == 403
    created = client.post('/api/interventions', headers=th, json=ibody)
    assert created.status_code == 201, created.text
    iid = created.json()['id']
    assert client.patch(f'/api/interventions/{iid}', headers=th, json={'status': 'completed', 'review_note': 'Activity completed with teacher review.'}).status_code == 200
    for stage in ['post', 'transfer']:
        followup = client.post(f'/api/students/{sid}/assessments', headers=h, json={'subject_id': 'mathematics', 'stage': stage, 'intervention_id': iid})
        assert followup.status_code == 201, followup.text
        fa = followup.json()
        for public in fa['items']:
            i = PACKS['mathematics'].item(public['id'])
            assert client.post(f'/api/assessments/{fa["id"]}/responses', headers=h, json={'item_id': i.id, 'answer': i.answers[0], 'reasoning': GOOD_REASONING, 'confidence': 4}).status_code == 201
        assert client.post(f'/api/assessments/{fa["id"]}/complete', headers=h).status_code == 200
    assert client.post(f'/api/students/{sid}/assessments', headers=h, json={'subject_id': 'mathematics', 'stage': 'retention', 'intervention_id': iid}).status_code == 409
    summary = client.get('/api/research/summary', headers=th).json()
    assert summary['students'] == 1 and summary['stages']['post']['performance']['mean'] == 1
    assert summary['stages']['transfer']['performance']['n'] == 1
    export = client.get('/api/research/export', headers=th)
    assert export.status_code == 200 and 'text/csv' in export.headers['content-type']
    assert sid not in export.text and 'learner_one' not in export.text and GOOD_REASONING not in export.text
    ai = client.post(f'/api/diagnostics/{diagnostic["id"]}/ai-assist', headers=th, json={'operation': 'student_explanation'})
    assert ai.status_code == 200 and ai.json()['fallback']
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(AIReview)) == 1
        assert db.scalar(select(func.count()).select_from(AuditLog)) > 10


def test_science_flow_and_record_access(client):
    h, sid = register(client)
    other, _ = register(client, 'other_learner')
    a = baseline(client, h, sid, 'science')
    assert client.get(f'/api/assessments/{a["id"]}', headers=other).status_code == 403
    assert client.post(f'/api/assessments/{a["id"]}/diagnostics', headers=h).status_code == 201
    graph = client.get('/api/subjects/science/graph?concept_id=science.heat', headers=h).json()
    assert graph['prerequisites'] == ['science.particles']


def test_delete_cascades_student_records(client, db_factory):
    h, sid = register(client)
    a = baseline(client, h, sid)
    client.post(f'/api/assessments/{a["id"]}/diagnostics', headers=h)
    assert client.delete(f'/api/students/{sid}', headers=h).status_code == 204
    assert client.get('/api/auth/me', headers=h).status_code == 401
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(Response)) == 0


def test_research_reference_metrics(client):
    th = staff_headers(client, 'researcher')
    body = {'reference_labels': ['gap', 'none'], 'predicted_labels': ['gap', 'none'], 'sus_responses': [[5, 1, 5, 1, 5, 1, 5, 1, 5, 1]]}
    r = client.post('/api/research/evaluate', headers=th, json=body)
    assert r.status_code == 200 and r.json()['agreement']['cohens_kappa'] == 1 and r.json()['sus']['mean'] == 100
    assert client.post('/api/research/evaluate', headers=th, json={**body, 'predicted_labels': ['one']}).status_code == 422


def test_ai_source_validation_and_missing_credentials():
    context = {'source_response_ids': ['R1'], 'rubrics': []}
    raw = {'explanation': 'Review evidence', 'source_response_ids': ['fabricated'], 'suggestions': []}
    with pytest.raises(ValueError, match='unsupported'):
        validate_suggestion(raw, context, 'reasoning_analysis')
    with pytest.raises(ValueError, match='Missing candidate'):
        validate_suggestion({**raw, 'source_response_ids': ['R1']}, context, 'verification_candidate')
    result = asyncio.run(GeminiProvider(Settings(gemini_api_key='', gemini_model='')).suggest('reasoning_analysis', context))
    assert result['fallback'] and result['fallback_reason']



def test_database_health_and_request_id(client, monkeypatch):
    import uuid
    from sqlalchemy.exc import OperationalError
    import app.main as main

    response = client.get('/health')
    assert response.status_code == 200
    uuid.UUID(response.headers['X-Request-ID'])

    def unavailable():
        raise OperationalError(None, None, RuntimeError('connection failed'))

    monkeypatch.setattr(main, 'SessionLocal', unavailable)
    response = client.get('/health')
    assert response.status_code == 503
    assert response.json() == {'status': 'unavailable'}
    uuid.UUID(response.headers['X-Request-ID'])


def test_production_configuration():
    import pytest
    from pydantic import ValidationError
    from app.core.config import Settings

    config = {'environment': 'production', 'database_url': 'postgresql+psycopg://lba@db/lba'}
    assert Settings(**config, cors_origins=[]).cors_origins == []
    assert Settings(**config, cors_origins=['https://lba.example.org']).cors_origins
    for origin in ('*', 'http://lba.example.org', 'https://lba.example.org/path', 'https://*.example.org'):
        with pytest.raises(ValidationError, match='exact HTTPS origins'):
            Settings(**config, cors_origins=[origin])
    with pytest.raises(ValidationError, match='requires a PostgreSQL'):
        Settings(environment='production', database_url='sqlite:///lba.db', cors_origins=[])



def test_portal_login_requires_matching_role(client):
    student, _ = register(client, 'portal_student')
    assert client.get('/api/ai/models', headers=student).status_code == 403
    credentials = {'handle': 'portal_student', 'password': 'test-password-123'}
    blocked = client.post('/api/auth/login/teacher', json=credentials)
    assert blocked.status_code == 403 and 'access_token' not in blocked.json()
    assert client.post('/api/auth/login/student', json=credentials).json()['user']['role'] == 'student'
    credentials['handle'] = 'teacher'
    assert client.post('/api/auth/login/student', json=credentials).status_code == 403
    assert client.post('/api/auth/login/teacher', json=credentials).json()['user']['role'] == 'teacher'



def test_teacher_selects_catalog_model_for_advisory(client, monkeypatch):
    from app.api import ai_hub_routes, diagnostic_routes

    student, sid = register(client)
    teacher = staff_headers(client)
    assessment = baseline(client, student, sid)
    run = client.post(f'/api/assessments/{assessment["id"]}/diagnostics', headers=student).json()
    path = f'/api/diagnostics/{run["id"]}/ai-assist'
    model_id = 'test/structured-model'
    calls = []

    async def catalog(**kwargs):
        return [
            {'id': model_id, 'supports_advisory': True, 'price_class': 'paid',
             'supported_parameters': ['reasoning'], 'context_length': 100000},
            {'id': 'test/reasoning-free', 'supports_advisory': True, 'price_class': 'free',
             'supported_parameters': ['reasoning'], 'context_length': 32000},
            {'id': 'test/general-free', 'supports_advisory': True, 'price_class': 'free',
             'supported_parameters': [], 'context_length': 64000},
        ]

    async def suggest(self, operation, context, selected):
        calls.append((operation, selected))
        assert context['source_response_ids']
        return {'provider': 'openrouter', 'model_id': selected, 'fallback': False}

    monkeypatch.setattr(diagnostic_routes.get_settings(), 'openrouter_api_key', 'test-only')
    monkeypatch.setattr(ai_hub_routes, 'catalog', catalog)
    monkeypatch.setattr(diagnostic_routes.OpenRouterProvider, 'suggest', suggest)
    body = {'operation': 'reasoning_analysis', 'model_id': model_id}
    assert client.post(path, headers=student, json=body).status_code == 403
    assert client.post(path, headers=teacher, json=body).status_code == 422
    assert client.post(path, headers=teacher, json={**body, 'model_id': 'unknown/model', 'allow_paid': True}).status_code == 422
    assert not calls
    response = client.post(path, headers=teacher, json={**body, 'allow_paid': True})
    assert response.status_code == 200
    assert response.json()['model_id'] == model_id
    assert calls == [('reasoning_analysis', model_id)]

    for operation, expected in (
        ('reasoning_analysis', 'test/reasoning-free'),
        ('student_explanation', 'test/general-free'),
    ):
        response = client.post(path, headers=teacher, json={'operation': operation, 'auto_model': True})
        assert response.status_code == 200
        assert response.json()['model_id'] == expected

    async def catalog_unavailable(**kwargs):
        raise ai_hub_routes.HTTPException(503, 'Catalog unavailable')

    monkeypatch.setattr(ai_hub_routes, 'catalog', catalog_unavailable)
    response = client.post(path, headers=teacher, json={'operation': 'student_explanation', 'auto_model': True})
    assert response.status_code == 200 and response.json()['fallback']
    assert len(calls) == 3



def test_curriculum_exam_drafts_are_teacher_only_and_reproducible(client):
    student, _ = register(client)
    teacher = staff_headers(client)
    researcher = staff_headers(client, 'researcher')
    path = '/api/curriculum/exam-drafts'
    body = {'indicator_id': 'ratio', 'count': 8, 'seed': 42}
    assert client.post(path, json=body).status_code == 401
    for headers in (student, researcher):
        assert client.post(path, headers=headers, json=body).status_code == 403
    assert client.post(path, headers=teacher, json={**body, 'indicator_id': 'unknown'}).status_code == 422
    assert client.post(path, headers=teacher, json={**body, 'count': 21}).status_code == 422
    indicators = client.get('/api/curriculum/exam-indicators', headers=teacher).json()
    assert {entry['id'] for entry in indicators} == {'rational', 'ratio', 'equation'}
    for indicator in indicators:
        request = {**body, 'indicator_id': indicator['id']}
        response = client.post(path, headers=teacher, json=request)
        assert response.status_code == 200
        draft = response.json()
        assert draft['status'] == 'draft' and draft['indicator'] == indicator
        assert draft['indicator']['source_url'].startswith('https://www.academic.obec.go.th/')
        assert len({item['prompt'] for item in draft['items']}) == 8
        for item in draft['items']:
            assert len(set(item['options'])) == 4
            assert 0 <= item['answer_index'] < 4
        assert client.post(path, headers=teacher, json=request).json() == draft



def test_qwen_drafts_require_teacher_official_source_and_cost_confirmation(client, monkeypatch):
    from app.api import curriculum_routes

    teacher = staff_headers(client)
    student, _ = register(client)
    path = '/api/curriculum/ai-exam-drafts'
    body = {'grade': 9, 'subject': 'history', 'code': 'S 4.1 M.3/1',
            'excerpt': 'Apply historical methods to investigate a topic.',
            'source_url': curriculum_routes.OBEC_INDICATORS, 'count': 1, 'allow_paid': True}
    calls = []

    async def generate(context, count):
        calls.append((context, count))
        return {'status': 'draft', 'model': 'qwen/qwen3.6-27b'}

    monkeypatch.setattr(curriculum_routes, 'generate_qwen_exam', generate)
    assert client.post(path, headers=student, json=body).status_code == 403
    assert client.post(path, headers=teacher, json={**body, 'grade': 10}).status_code == 422
    assert client.post(path, headers=teacher, json={**body, 'source_url': 'https://example.org'}).status_code == 422
    assert client.post(path, headers=teacher, json={**body, 'allow_paid': False}).status_code == 422
    assert client.post(path, headers=teacher, json=body).json()['model'] == 'qwen/qwen3.6-27b'
    assert calls == [({k: v for k, v in body.items() if k not in ('count', 'allow_paid')}, 1)]
