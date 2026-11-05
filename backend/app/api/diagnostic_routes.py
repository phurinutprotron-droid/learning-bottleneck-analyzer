from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import current_user, staff
from app.models.entities import User, DiagnosticRun, Evidence, Hypothesis, Assessment, Verification, AIReview
from app.repositories.records import owned_assessment, pack_for, responses_for, audit, require_consent
from app.diagnostics.engine import ENGINE_VERSION, diagnose
from app.schemas.contracts import AIInput
from app.services.ai_provider import DeterministicProvider
from app.services.gemini_provider import GeminiProvider
from app.services.openrouter_provider import OpenRouterProvider
from app.api.ai_hub_routes import choose_auto_model, require_advisory_model
from app.interventions.planner import recommend
from app.analytics.bottleneck_scoring import prioritize

router = APIRouter(tags=['Diagnostics'])


def run_view(db, run):
    evidence = [{'id': e.id, **e.payload} for e in db.scalars(select(Evidence).where(Evidence.run_id == run.id))]
    hypotheses = [{'id': h.id, **h.payload} for h in db.scalars(select(Hypothesis).where(Hypothesis.run_id == run.id))]
    verifications = list(db.scalars(select(Verification).where(Verification.run_id == run.id)))
    updates = [u for v in verifications if v.result for u in v.result['updates']]
    for h in hypotheses:
        matching = [u for u in updates if u['kind'] == h['kind'] and u['concept_id'] == h['concept_id']]
        h['verification_history'] = matching
        h['verification_status'] = matching[-1]['verification_status'] if matching else 'not_tested'
        h['initial_support'] = h['support']
        if matching:
            h['support'] = matching[-1]['updated_support']
            h['uncertainty'] = matching[-1]['uncertainty']
        a = db.get(Assessment, run.assessment_id)
        observation = next(e for e in evidence if e['concept_id'] == h['concept_id'])
        h['priority'] = prioritize(pack_for(db, a), observation, verified=h['verification_status'] == 'supported')
    return {'id': run.id, 'assessment_id': run.assessment_id, 'engine_version': run.engine_version, 'created_at': run.created_at,
            'evidence': evidence, 'hypotheses': hypotheses,
            'verifications': [{'id': v.id, 'assessment_id': v.assessment_id, 'selection': v.selection, 'result': v.result} for v in verifications],
            'interpretation': 'Diagnostic inferences from unvalidated sample content. No clinical or causal labels.'}


@router.post('/assessments/{assessment_id}/diagnostics', status_code=201)
def create_run(assessment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = owned_assessment(db, assessment_id, user)
    require_consent(db, a.student_id)
    if a.status != 'completed' or a.stage != 'pre':
        raise HTTPException(409, 'Complete a baseline assessment first')
    existing = db.scalar(select(DiagnosticRun).where(DiagnosticRun.assessment_id == a.id))
    if existing:
        return run_view(db, existing)
    evidence, hypotheses = diagnose(pack_for(db, a), responses_for(db, a.id))
    run = DiagnosticRun(assessment_id=a.id, engine_version=ENGINE_VERSION)
    db.add(run)
    db.flush()
    for e in evidence:
        db.add(Evidence(run_id=run.id, payload=e))
    for h in hypotheses:
        db.add(Hypothesis(run_id=run.id, payload=h))
    audit(db, user, 'diagnostic.created')
    db.flush()
    return run_view(db, run)


@router.get('/diagnostics/{run_id}')
def detail(run_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    run = db.get(DiagnosticRun, run_id)
    if not run:
        raise HTTPException(404, 'Diagnostic not found')
    owned_assessment(db, run.assessment_id, user)
    return run_view(db, run)


@router.get('/diagnostics/{run_id}/recommendations')
def recommendations(run_id: str, user: User = Depends(staff), db: Session = Depends(get_db)):
    run = db.get(DiagnosticRun, run_id)
    if not run:
        raise HTTPException(404, 'Diagnostic not found')
    a = owned_assessment(db, run.assessment_id, user)
    pack = pack_for(db, a)
    view = run_view(db, run)
    concepts = {h['concept_id'] for h in view['hypotheses'] if h['kind'] in ('knowledge_gap', 'reasoning_gap', 'misconception') and h['verification_status'] != 'contradicted'}
    return [recommend(pack, cid) for cid in sorted(concepts)]


@router.post('/diagnostics/{run_id}/ai-assist')
async def ai_assist(run_id: str, body: AIInput, user: User = Depends(staff), db: Session = Depends(get_db)):
    run = db.get(DiagnosticRun, run_id)
    if not run:
        raise HTTPException(404, 'Diagnostic not found')
    a = owned_assessment(db, run.assessment_id, user)
    require_consent(db, a.student_id)
    pack, responses = pack_for(db, a), responses_for(db, a.id)
    # Pseudorandom per-request references, not persistent student or response IDs, go to Gemini.
    context = {'source_response_ids': [f'R{n+1}' for n in range(len(responses))],
               'observations': [{'source_id': f'R{n+1}', 'concept_id': pack.item(r.item_id).concept_id, 'correct': r.correct, 'rubric_observations': r.rubric} for n, r in enumerate(responses)],
               'rubrics': [{'concept_id': c.id, 'objective': next(i for i in pack.items if i.concept_id == c.id).objective,
                            'difficulty': 'introductory', 'rubric': next(i for i in pack.items if i.concept_id == c.id).rubric.model_dump()} for c in pack.concepts]}
    settings = get_settings()
    if body.gemini_analysis:
        if body.model_id or body.auto_model or body.operation != 'reasoning_analysis':
            raise HTTPException(422, 'Gemini evidence analysis requires the reasoning_analysis task')
        result = await GeminiProvider(settings).suggest(body.operation, context)
    elif body.model_id:
        if not settings.openrouter_api_key:
            raise HTTPException(503, 'OpenRouter is not configured on the server')
        await require_advisory_model(body.model_id, body.allow_paid)
        result = await OpenRouterProvider(settings).suggest(body.operation, context, body.model_id)
    elif body.auto_model:
        selected = None
        if settings.openrouter_api_key:
            selected = await choose_auto_model(
                body.operation, settings.openrouter_task_models.get(body.operation, ''), settings.openrouter_model,
            )
        if selected:
            result = await OpenRouterProvider(settings).suggest(body.operation, context, selected)
        else:
            result = await DeterministicProvider().suggest(body.operation, context)
            result['fallback_reason'] = 'No eligible free OpenRouter model could be selected'
    elif settings.ai_provider == 'openrouter':
        provider = OpenRouterProvider(settings)
    elif settings.ai_provider == 'gemini':
        provider = GeminiProvider(settings)
    else:
        provider = DeterministicProvider()
    if not (body.model_id or body.auto_model or body.gemini_analysis):
        result = await provider.suggest(body.operation, context)
    result['source_mapping'] = {f'R{n+1}': r.id for n, r in enumerate(responses)}
    db.add(AIReview(run_id=run.id, payload=result))
    audit(db, user, 'ai.advisory_requested')
    return result
