from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('ai_reviews', sa.Column('id', sa.String(36), primary_key=True), sa.Column('run_id', sa.String(36), sa.ForeignKey('diagnostic_runs.id', ondelete='CASCADE'), nullable=False), sa.Column('payload', sa.JSON(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))


def downgrade():
    op.drop_table('ai_reviews')
