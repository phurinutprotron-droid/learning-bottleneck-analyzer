from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import staff, accessible_student
from app.models.entities import User, Intervention, now
from app.schemas.contracts import InterventionInput, InterventionUpdate
from app.repositories.records import owned_assessment, pack_for, require_consent, audit

router = APIRouter(prefix='/interventions', tags=['Interventions'])


@router.post('', status_code=201)
def assign(body: InterventionInput, user: User = Depends(staff), db: Session = Depends(get_db)):
    accessible_student(db, body.student_id, user)
    require_consent(db, body.student_id)
    baseline = owned_assessment(db, body.baseline_assessment_id, user)
    pack = pack_for(db, baseline)
    if baseline.student_id != body.student_id or baseline.stage != 'pre' or baseline.status != 'completed' or pack.id != body.subject_id:
        raise HTTPException(422, 'Baseline must be a completed pre-assessment for this learner and subject')
    if body.concept_id not in {c.id for c in pack.concepts}:
        raise HTTPException(422, 'Concept is not in this subject')
    i = Intervention(student_id=body.student_id, teacher_id=user.id, subject_version=baseline.subject_version,
                     baseline_assessment_id=baseline.id, concept_id=body.concept_id, activity=body.activity,
                     expected_outcome=body.expected_outcome, review_note=body.review_note)
    db.add(i)
    db.flush()
    audit(db, user, 'intervention.teacher_approved')
    return {'id': i.id, 'status': i.status}


@router.patch('/{intervention_id}')
def update(intervention_id: str, body: InterventionUpdate, user: User = Depends(staff), db: Session = Depends(get_db)):
    i = db.get(Intervention, intervention_id)
    if not i:
        raise HTTPException(404, 'Intervention not found')
    accessible_student(db, i.student_id, user)
    if i.status != 'assigned':
        raise HTTPException(409, 'Completed or cancelled history is immutable; create a new intervention')
    i.status, i.review_note = body.status, body.review_note
    i.completed_at = now() if body.status == 'completed' else None
    audit(db, user, 'intervention.' + body.status)
    return {'id': i.id, 'status': i.status}
