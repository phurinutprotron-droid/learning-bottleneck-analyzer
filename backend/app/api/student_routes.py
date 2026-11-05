from fastapi import APIRouter, Depends, HTTPException, Response as HTTPResponse
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_user, staff, accessible_student
from app.core.config import get_settings
from app.models.entities import Student, User, Consent, Assessment, Intervention, LearningResult
from app.schemas.contracts import ConsentInput
from app.repositories.records import audit, assessment_view

router = APIRouter(tags=['Students'])


@router.get('/students')
def students(user: User = Depends(staff), db: Session = Depends(get_db)):
    return [{'id': s.id, 'anonymous_id': s.anonymous_id, 'grade': s.grade,
             'assessments_completed': len(list(db.scalars(select(Assessment.id).where(Assessment.student_id == s.id, Assessment.status == 'completed'))))}
            for s in db.scalars(select(Student).order_by(Student.anonymous_id))]


@router.get('/students/{student_id}')
def profile(student_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    student = accessible_student(db, student_id, user)
    consent = db.scalar(select(Consent).where(Consent.student_id == student_id).order_by(Consent.created_at.desc(), Consent.id.desc()))
    assessments = list(db.scalars(select(Assessment).where(Assessment.student_id == student_id).order_by(Assessment.created_at.desc())))
    interventions = list(db.scalars(select(Intervention).where(Intervention.student_id == student_id).order_by(Intervention.created_at.desc())))
    outcomes = list(db.scalars(select(LearningResult).join(Assessment, LearningResult.assessment_id == Assessment.id).where(Assessment.student_id == student_id)))
    return {'id': student.id, 'anonymous_id': student.anonymous_id, 'grade': student.grade,
            'consent': bool(consent and consent.granted and consent.version == get_settings().consent_version),
            'consent_version': get_settings().consent_version,
            'assessments': [assessment_view(db, a) for a in assessments],
            'interventions': [{'id': i.id, 'concept_id': i.concept_id, 'activity': i.activity, 'expected_outcome': i.expected_outcome,
                               'status': i.status, 'review_note': i.review_note, 'subject_id': i.subject_version.split(':')[0]} for i in interventions],
            'outcomes': [o.payload for o in outcomes]}


@router.post('/students/{student_id}/consent')
def consent(student_id: str, body: ConsentInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    accessible_student(db, student_id, user)
    db.add(Consent(student_id=student_id, version=get_settings().consent_version, granted=body.granted))
    audit(db, user, 'consent.granted' if body.granted else 'consent.withdrawn')
    return {'granted': body.granted, 'version': get_settings().consent_version,
            'notice': 'Pilot assent record only. School/guardian authorization and reviewed notices are required before use with minors.'}


@router.delete('/students/{student_id}', status_code=204)
def erase(student_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    student = accessible_student(db, student_id, user)
    # Break the nullable intervention/baseline reference before cascaded deletion.
    for a in db.scalars(select(Assessment).where(Assessment.student_id == student_id)):
        a.intervention_id = None
    db.flush()
    db.execute(delete(User).where(User.id == student.user_id))
    audit(db, user, 'student.data_deleted') if user.id != student.user_id else None
    return HTTPResponse(status_code=204)
