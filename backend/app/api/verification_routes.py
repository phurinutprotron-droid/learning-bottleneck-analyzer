from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_user
from app.models.entities import User, Assessment, DiagnosticRun, Hypothesis, Verification
from app.repositories.records import owned_assessment, pack_for, responses_for, assessment_view, audit, require_consent
from app.diagnostics.verification_engine import select_verification, update_support

router = APIRouter(tags=['Verification'])


@router.get('/assessments/{assessment_id}/verification')
def association(assessment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = owned_assessment(db, assessment_id, user)
    v = db.scalar(select(Verification).where(Verification.assessment_id == a.id))
    if not v:
        raise HTTPException(404, 'Assessment is not a verification')
    run = db.get(DiagnosticRun, v.run_id)
    return {'verification_id': v.id, 'run_id': v.run_id, 'baseline_assessment_id': run.assessment_id}


@router.post('/diagnostics/{run_id}/verification', status_code=201)
def assign(run_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    run = db.get(DiagnosticRun, run_id)
    if not run:
        raise HTTPException(404, 'Diagnostic not found')
    baseline = owned_assessment(db, run.assessment_id, user)
    require_consent(db, baseline.student_id)
    history = list(db.scalars(select(Verification).where(Verification.run_id == run.id)))
    for v in history:
        if v.result is None:
            return {'id': v.id, 'assessment': assessment_view(db, db.get(Assessment, v.assessment_id)), 'selection': v.selection}
    pack = pack_for(db, baseline)
    used = {i for v in history for i in db.get(Assessment, v.assessment_id).item_ids}
    hypotheses = [h.payload for h in db.scalars(select(Hypothesis).where(Hypothesis.run_id == run.id))]
    # Apply the most recent support update without overwriting the initial diagnostic snapshot.
    for v in history:
        for update in (v.result or {}).get('updates', []):
            for h in hypotheses:
                if h['kind'] == update['kind'] and h['concept_id'] == update['concept_id']:
                    h['support'] = update['updated_support']
                    h['uncertainty'] = update['uncertainty']
    selected = select_verification(pack, hypotheses, used)
    if selected is None:
        raise HTTPException(409, 'No unused curated verification items distinguish the remaining hypotheses')
    item, reason = selected
    a = Assessment(student_id=baseline.student_id, subject_version=baseline.subject_version, stage='verification', item_ids=[item.id])
    db.add(a)
    db.flush()
    v = Verification(run_id=run.id, assessment_id=a.id, selection=reason)
    db.add(v)
    db.flush()
    audit(db, user, 'verification.assigned')
    return {'id': v.id, 'assessment': assessment_view(db, a), 'selection': reason}


@router.post('/verifications/{verification_id}/evaluate')
def evaluate(verification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = db.get(Verification, verification_id)
    if not v:
        raise HTTPException(404, 'Verification not found')
    a = owned_assessment(db, v.assessment_id, user)
    require_consent(db, a.student_id)
    if a.status != 'completed':
        raise HTTPException(409, 'Complete the verification assessment first')
    if v.result is not None:
        return v.result
    hs = [h.payload for h in db.scalars(select(Hypothesis).where(Hypothesis.run_id == v.run_id))]
    prior = list(db.scalars(select(Verification).where(Verification.run_id == v.run_id)))
    for previous in prior:
        for u in (previous.result or {}).get('updates', []):
            for h in hs:
                if h['kind'] == u['kind'] and h['concept_id'] == u['concept_id']:
                    h['support'] = u['updated_support']
                    h['uncertainty'] = u['uncertainty']
    pack = pack_for(db, a)
    r = responses_for(db, a.id)[0]
    v.result = {'updates': update_support(hs, pack.item(r.item_id), r), 'response_id': r.id,
                'interpretation': 'Verification support is provisional, not experimental proof.'}
    audit(db, user, 'verification.evaluated')
    return v.result
