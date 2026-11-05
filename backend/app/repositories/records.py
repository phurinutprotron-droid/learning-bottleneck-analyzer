from fastapi import HTTPException
from sqlalchemy import select
from app.models.entities import Assessment, Consent, SubjectVersion, Response, AuditLog, Student
from app.subjects.base_pack import SubjectPack, public_item
from app.core.security import accessible_student
from app.core.config import get_settings


def audit(db, actor, action: str):
    db.add(AuditLog(actor_id=actor.id, action=action))


def require_consent(db, student_id: str):
    consent = db.scalar(select(Consent).where(Consent.student_id == student_id).order_by(Consent.created_at.desc(), Consent.id.desc()))
    if not consent or not consent.granted or consent.version != get_settings().consent_version:
        raise HTTPException(409, 'Current consent required before collecting assessment data')


def owned_assessment(db, assessment_id, user):
    assessment = db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(404, 'Assessment not found')
    accessible_student(db, assessment.student_id, user)
    return assessment


def pack_for(db, assessment):
    return SubjectPack.model_validate(db.get(SubjectVersion, assessment.subject_version).snapshot)


def responses_for(db, assessment_id):
    return list(db.scalars(select(Response).where(Response.assessment_id == assessment_id).order_by(Response.created_at, Response.id)))


def assessment_view(db, a):
    pack = pack_for(db, a)
    rs = responses_for(db, a.id)
    return {'id': a.id, 'student_id': a.student_id, 'subject_id': pack.id, 'subject_version': a.subject_version,
            'graph_version': pack.graph_version, 'stage': a.stage, 'status': a.status, 'created_at': a.created_at,
            'intervention_id': a.intervention_id, 'review_status': pack.review_status,
            'items': [public_item(pack.item(i)) for i in a.item_ids],
            'responses': [{'id': r.id, 'item_id': r.item_id, 'answer': r.answer, 'reasoning': r.reasoning, 'confidence': r.confidence,
                           **({'correct': r.correct, 'rubric': r.rubric} if a.status == 'completed' else {})} for r in rs]}
