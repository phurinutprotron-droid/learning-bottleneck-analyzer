from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_user, accessible_student
from app.models.entities import User, Assessment, Response, Intervention, LearningResult, now
from app.schemas.contracts import AssessmentInput, AnswerInput
from app.subjects.registry import PACKS
from app.repositories.records import require_consent, owned_assessment, pack_for, responses_for, assessment_view, audit
from app.diagnostics.evidence_analyzer import grade

router = APIRouter(tags=['Assessments'])


@router.post('/students/{student_id}/assessments', status_code=201)
def create(student_id: str, body: AssessmentInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    accessible_student(db, student_id, user)
    require_consent(db, student_id)
    if body.subject_id not in PACKS:
        raise HTTPException(404, 'Subject not found')
    pack = PACKS[body.subject_id]
    version = f'{pack.id}:{pack.version}'
    if body.stage != 'pre':
        intervention = db.get(Intervention, body.intervention_id) if body.intervention_id else None
        if not intervention or intervention.student_id != student_id or intervention.subject_version != version or intervention.status != 'completed':
            raise HTTPException(409, 'A completed intervention in this subject is required for follow-up')
        if db.scalar(select(Assessment).where(Assessment.intervention_id == intervention.id, Assessment.stage == body.stage)):
            raise HTTPException(409, 'A follow-up for this stage already exists; resume it instead')
        if body.stage == 'retention' and (now() - intervention.completed_at.replace(tzinfo=now().tzinfo)).days < 7:
            raise HTTPException(409, 'Retention follow-up requires at least seven days after intervention completion')
        items = [i.id for i in pack.items if i.stage == body.stage and i.concept_id == intervention.concept_id]
    else:
        if body.intervention_id:
            raise HTTPException(422, 'Baseline assessments cannot be linked as follow-ups')
        items = [i.id for i in pack.items if i.stage == 'pre']
        existing = db.scalar(select(Assessment).where(Assessment.student_id == student_id, Assessment.subject_version == version, Assessment.stage == 'pre', Assessment.status == 'open'))
        if existing:
            raise HTTPException(409, 'An open baseline exists; resume it from your profile')
    a = Assessment(student_id=student_id, subject_version=version, stage=body.stage, item_ids=items, intervention_id=body.intervention_id)
    db.add(a)
    db.flush()
    audit(db, user, 'assessment.created')
    return assessment_view(db, a)


@router.get('/assessments/{assessment_id}')
def detail(assessment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return assessment_view(db, owned_assessment(db, assessment_id, user))


@router.post('/assessments/{assessment_id}/responses', status_code=201)
def submit(assessment_id: str, body: AnswerInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = owned_assessment(db, assessment_id, user)
    require_consent(db, a.student_id)
    if a.status != 'open':
        raise HTTPException(409, 'Assessment already completed')
    if body.item_id not in a.item_ids:
        raise HTTPException(422, 'Item is not part of this assessment')
    if db.scalar(select(Response).where(Response.assessment_id == a.id, Response.item_id == body.item_id)):
        raise HTTPException(409, 'Original response is immutable; duplicate submission rejected')
    item = pack_for(db, a).item(body.item_id)
    if item.options and body.answer not in item.options:
        raise HTTPException(422, 'Choose an approved option')
    correct, rubric = grade(item, body.answer, body.reasoning)
    r = Response(assessment_id=a.id, item_id=item.id, item_version=item.version, answer=body.answer,
                 reasoning=body.reasoning, confidence=body.confidence, correct=correct, rubric=rubric)
    db.add(r)
    db.flush()
    audit(db, user, 'response.recorded')
    # No answer feedback until completion, to reduce contamination of subsequent items.
    return {'id': r.id, 'item_id': r.item_id, 'saved': True}


@router.post('/assessments/{assessment_id}/complete')
def complete(assessment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = owned_assessment(db, assessment_id, user)
    require_consent(db, a.student_id)
    rs = responses_for(db, a.id)
    if len(rs) != len(a.item_ids):
        raise HTTPException(409, 'Answer every item before completing the assessment')
    if a.status == 'completed':
        return assessment_view(db, a)
    a.status = 'completed'
    if a.stage in ('post', 'transfer', 'retention'):
        intervention = db.get(Intervention, a.intervention_id)
        baseline = db.get(Assessment, intervention.baseline_assessment_id)
        if not baseline:
            raise HTTPException(409, 'Baseline unavailable; follow-up comparison cannot be computed')
        pack = pack_for(db, baseline)
        pre = [r for r in responses_for(db, baseline.id) if pack.item(r.item_id).concept_id == intervention.concept_id]
        pre_score = sum(r.correct for r in pre) / len(pre) if pre else None
        post_score = sum(r.correct for r in rs) / len(rs)
        db.add(LearningResult(assessment_id=a.id, payload={
            'stage': a.stage, 'concept_id': intervention.concept_id, 'subject_id': pack.id,
            'pre_n': len(pre), 'followup_n': len(rs), 'pre_performance': pre_score, 'followup_performance': post_score,
            'descriptive_difference': post_score - pre_score if pre_score is not None else None,
            'days_since_intervention': (now() - intervention.completed_at.replace(tzinfo=now().tzinfo)).days,
            'interpretation': 'Descriptive comparison on different, uncalibrated sample items; not an intervention effect or equated gain.',
        }))
    audit(db, user, 'assessment.completed')
    db.flush()
    return assessment_view(db, a)
