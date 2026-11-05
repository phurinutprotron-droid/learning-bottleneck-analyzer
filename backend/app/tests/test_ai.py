import asyncio
import json
import httpx
import pytest
from google import genai
from app.core.config import Settings
from app.services.gemini_provider import GeminiProvider, validate_suggestion
from app.subjects.registry import MATHEMATICS


@pytest.mark.parametrize('mode', ['ok', 'invalid_model', 'rate_limit', 'unavailable', 'empty', 'invalid_source', 'gateway_timeout', 'gateway_recovers', 'timeout', 'timeout_recovers', 'invalid_json'])
def test_gemini_transport_validation_and_fallback(monkeypatch, mode):
    context = {'source_response_ids': ['R1'], 'rubrics': []}
    generation_attempts = []
    def handler(request):
        assert request.headers['x-goog-api-key'] == 'test-only-fake-key'
        if request.method == 'GET':
            return httpx.Response(200, json={'supportedGenerationMethods': [] if mode == 'invalid_model' else ['generateContent']})
        generation_attempts.append(request)
        if mode == 'gateway_timeout' or (mode == 'gateway_recovers' and len(generation_attempts) < 3):
            return httpx.Response(504, json={'error': {'code': 504, 'status': 'DEADLINE_EXCEEDED'}})
        if mode == 'timeout' or (mode == 'timeout_recovers' and len(generation_attempts) == 1):
            raise httpx.ReadTimeout('simulated', request=request)
        if mode == 'rate_limit':
            return httpx.Response(429, json={'error': {'code': 429, 'status': 'RESOURCE_EXHAUSTED'}})
        if mode == 'unavailable':
            return httpx.Response(503, json={'error': {'code': 503, 'status': 'UNAVAILABLE'}})
        if mode == 'empty':
            return httpx.Response(200, json={'candidates': []})
        suggestion = {'explanation': 'Teacher should review the supplied evidence.', 'source_response_ids': ['bad' if mode == 'invalid_source' else 'R1'], 'suggestions': ['Review a worked example.']}
        body = json.loads(request.content)
        assert body['generationConfig']['responseMimeType'] == 'application/json'
        assert 'source_response_ids' in body['generationConfig']['responseJsonSchema']['properties']
        return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': 'broken-json' if mode == 'invalid_json' else json.dumps(suggestion)}]}}]})
    real_client = genai.Client

    def client_with_mock_transport(**kwargs):
        kwargs['http_options'].async_client_args = {'transport': httpx.MockTransport(handler)}
        return real_client(**kwargs)

    monkeypatch.setattr('app.services.gemini_provider.genai.Client', client_with_mock_transport)
    delays = []
    async def sleep(delay):
        delays.append(delay)

    monkeypatch.setattr('app.services.gemini_provider.asyncio.sleep', sleep)
    monkeypatch.setattr('app.services.gemini_provider.random.uniform', lambda low, high: high)
    result = asyncio.run(GeminiProvider(Settings(gemini_api_key='test-only-fake-key', gemini_model='configured-test-model')).suggest('reasoning_analysis', context))
    assert result['fallback'] is (mode not in {'ok', 'gateway_recovers', 'timeout_recovers'})
    if mode in {'gateway_timeout', 'gateway_recovers', 'timeout', 'unavailable', 'rate_limit'}:
        assert len(generation_attempts) == 3
        assert delays == [0.5, 1.0]
    elif mode == 'timeout_recovers':
        assert len(generation_attempts) == 2
        assert delays == [0.5]
    else:
        assert not delays
    if mode == 'gateway_timeout':
        assert 'HTTP 504' in result['fallback_reason']
    if mode == 'unavailable':
        assert 'HTTP 503' in result['fallback_reason']
    if mode == 'ok':
        assert result['model_id'] == 'configured-test-model' and result['requires_teacher_review']


def test_ai_question_requires_matching_approved_rubric_objective_and_difficulty():
    item = next(i for i in MATHEMATICS.items if i.stage == 'verification')
    context = {'source_response_ids': ['R1'], 'rubrics': [{'concept_id': item.concept_id, 'objective': item.objective, 'rubric': item.rubric.model_dump(), 'difficulty': item.difficulty}]}
    raw = {'explanation': 'Candidate for teacher review.', 'source_response_ids': ['R1'], 'suggestions': [], 'candidate': item.model_dump()}
    assert validate_suggestion(raw, context, 'verification_candidate').candidate
    raw['candidate'] = {**item.model_dump(), 'objective': 'unapproved objective'}
    with pytest.raises(ValueError, match='objective'):
        validate_suggestion(raw, context, 'verification_candidate')
