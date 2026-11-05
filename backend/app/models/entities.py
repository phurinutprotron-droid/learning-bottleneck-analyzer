"""Persist original observations and append-only analytical snapshots separately."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, JSON, Boolean, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    handle: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(16), default='student')
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default='0')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SessionToken(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Student(Base):
    __tablename__ = 'students'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), unique=True)
    anonymous_id: Mapped[str] = mapped_column(String(24), unique=True, default=lambda: 'L-' + uuid.uuid4().hex[:10])
    grade: Mapped[int] = mapped_column(Integer, default=7)


class Consent(Base):
    __tablename__ = 'consents'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    student_id: Mapped[str] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'))
    version: Mapped[str] = mapped_column(String(32))
    granted: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SubjectVersion(Base):
    __tablename__ = 'subject_versions'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    snapshot: Mapped[dict] = mapped_column(JSON)


class Assessment(Base):
    __tablename__ = 'assessments'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    student_id: Mapped[str] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'))
    subject_version: Mapped[str] = mapped_column(ForeignKey('subject_versions.id'))
    stage: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default='open')
    item_ids: Mapped[list] = mapped_column(JSON)
    intervention_id: Mapped[str | None] = mapped_column(ForeignKey('interventions.id', ondelete='SET NULL', use_alter=True, name='fk_assessment_intervention'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Response(Base):
    __tablename__ = 'responses'
    __table_args__ = (UniqueConstraint('assessment_id', 'item_id'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id', ondelete='CASCADE'))
    item_id: Mapped[str] = mapped_column(String(80))
    item_version: Mapped[str] = mapped_column(String(32))
    answer: Mapped[str] = mapped_column(String(2000))
    reasoning: Mapped[str] = mapped_column(String(4000))
    confidence: Mapped[int] = mapped_column(Integer)
    correct: Mapped[bool] = mapped_column(Boolean)
    rubric: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DiagnosticRun(Base):
    __tablename__ = 'diagnostic_runs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id', ondelete='CASCADE'))
    engine_version: Mapped[str] = mapped_column(String(32), default='rules-v1')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Evidence(Base):
    __tablename__ = 'evidence'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(ForeignKey('diagnostic_runs.id', ondelete='CASCADE'))
    payload: Mapped[dict] = mapped_column(JSON)


class Hypothesis(Base):
    __tablename__ = 'hypotheses'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(ForeignKey('diagnostic_runs.id', ondelete='CASCADE'))
    payload: Mapped[dict] = mapped_column(JSON)


class Verification(Base):
    __tablename__ = 'verifications'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(ForeignKey('diagnostic_runs.id', ondelete='CASCADE'))
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id', ondelete='CASCADE'), unique=True)
    selection: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Intervention(Base):
    __tablename__ = 'interventions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    student_id: Mapped[str] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'))
    teacher_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='RESTRICT'))
    subject_version: Mapped[str] = mapped_column(ForeignKey('subject_versions.id'))
    baseline_assessment_id: Mapped[str | None] = mapped_column(ForeignKey('assessments.id', ondelete='SET NULL'), nullable=True)
    concept_id: Mapped[str] = mapped_column(String(80))
    activity: Mapped[str] = mapped_column(String(2000))
    expected_outcome: Mapped[str] = mapped_column(String(1000))
    review_note: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(20), default='assigned')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LearningResult(Base):
    __tablename__ = 'learning_results'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey('assessments.id', ondelete='CASCADE'), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AIReview(Base):
    __tablename__ = 'ai_reviews'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(ForeignKey('diagnostic_runs.id', ondelete='CASCADE'))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
