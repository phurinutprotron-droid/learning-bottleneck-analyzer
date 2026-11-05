"""Initial schema, explicit snapshot so future model edits cannot alter this migration."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('users', sa.Column('id', sa.String(36), primary_key=True), sa.Column('handle', sa.String(64), unique=True, nullable=False), sa.Column('password_hash', sa.String(256), nullable=False), sa.Column('role', sa.String(16), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('sessions', sa.Column('token_hash', sa.String(64), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('students', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True), sa.Column('anonymous_id', sa.String(24), nullable=False, unique=True), sa.Column('grade', sa.Integer(), nullable=False))
    op.create_table('consents', sa.Column('id', sa.String(36), primary_key=True), sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False), sa.Column('version', sa.String(32), nullable=False), sa.Column('granted', sa.Boolean(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('subject_versions', sa.Column('id', sa.String(100), primary_key=True), sa.Column('snapshot', sa.JSON(), nullable=False))
    op.create_table('assessments', sa.Column('id', sa.String(36), primary_key=True), sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False), sa.Column('subject_version', sa.String(100), sa.ForeignKey('subject_versions.id'), nullable=False), sa.Column('stage', sa.String(16), nullable=False), sa.Column('status', sa.String(16), nullable=False), sa.Column('item_ids', sa.JSON(), nullable=False), sa.Column('intervention_id', sa.String(36), nullable=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('interventions', sa.Column('id', sa.String(36), primary_key=True), sa.Column('student_id', sa.String(36), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False), sa.Column('teacher_id', sa.String(36), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False), sa.Column('subject_version', sa.String(100), sa.ForeignKey('subject_versions.id'), nullable=False), sa.Column('baseline_assessment_id', sa.String(36), sa.ForeignKey('assessments.id', ondelete='SET NULL'), nullable=True), sa.Column('concept_id', sa.String(80), nullable=False), sa.Column('activity', sa.String(2000), nullable=False), sa.Column('expected_outcome', sa.String(1000), nullable=False), sa.Column('review_note', sa.String(1000), nullable=False), sa.Column('status', sa.String(20), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    with op.batch_alter_table('assessments') as batch:
        batch.create_foreign_key('fk_assessment_intervention', 'interventions', ['intervention_id'], ['id'], ondelete='SET NULL')
    op.create_table('responses', sa.Column('id', sa.String(36), primary_key=True), sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False), sa.Column('item_id', sa.String(80), nullable=False), sa.Column('item_version', sa.String(32), nullable=False), sa.Column('answer', sa.String(2000), nullable=False), sa.Column('reasoning', sa.String(4000), nullable=False), sa.Column('confidence', sa.Integer(), nullable=False), sa.Column('correct', sa.Boolean(), nullable=False), sa.Column('rubric', sa.JSON(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint('assessment_id', 'item_id'))
    op.create_table('diagnostic_runs', sa.Column('id', sa.String(36), primary_key=True), sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False), sa.Column('engine_version', sa.String(32), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    for name in ['evidence', 'hypotheses']:
        op.create_table(name, sa.Column('id', sa.String(36), primary_key=True), sa.Column('run_id', sa.String(36), sa.ForeignKey('diagnostic_runs.id', ondelete='CASCADE'), nullable=False), sa.Column('payload', sa.JSON(), nullable=False))
    op.create_table('verifications', sa.Column('id', sa.String(36), primary_key=True), sa.Column('run_id', sa.String(36), sa.ForeignKey('diagnostic_runs.id', ondelete='CASCADE'), nullable=False), sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False, unique=True), sa.Column('selection', sa.JSON(), nullable=False), sa.Column('result', sa.JSON(), nullable=True))
    op.create_table('learning_results', sa.Column('id', sa.String(36), primary_key=True), sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False, unique=True), sa.Column('payload', sa.JSON(), nullable=False))
    op.create_table('audit_logs', sa.Column('id', sa.String(36), primary_key=True), sa.Column('actor_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True), sa.Column('action', sa.String(80), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))


def downgrade():
    for table in ['audit_logs', 'learning_results', 'verifications', 'hypotheses', 'evidence', 'diagnostic_runs', 'responses']:
        op.drop_table(table)
    with op.batch_alter_table('assessments') as batch:
        batch.drop_constraint('fk_assessment_intervention', type_='foreignkey')
    for table in ['interventions', 'assessments', 'subject_versions', 'consents', 'students', 'sessions', 'users']:
        op.drop_table(table)
